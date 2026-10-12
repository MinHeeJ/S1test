export interface ApiResponse<T = never> {
  success: true;
  meta: Record<string, unknown>;
  data?: T;
}
export interface ApiError {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
}
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
  }
}
let csrf: { token: string; header: string } | undefined;
let bootstrap: Promise<void> | undefined;

/** Tokens remain only in memory; repeat after authentication replaces the session. */
export async function refreshCsrf(): Promise<void> {
  const response = await fetch("/api/health", { credentials: "same-origin" });
  if (!response.ok) throw new Error("서비스에 연결하지 못했습니다.");
  const body: ApiResponse = await response.json();
  const token = body.meta.csrfToken;
  const header = body.meta.csrfHeaderName;
  if (typeof token !== "string" || typeof header !== "string") {
    throw new Error("요청 검증 정보를 가져오지 못했습니다.");
  }
  csrf = { token, header };
}

/** All feature requests use relative paths, session cookies and the bootstrap CSRF header. */
export async function apiRequest<T = never>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new TypeError("API 경로는 /api/로 시작해야 합니다.");
  const method = (init.method ?? "GET").toUpperCase();
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (mutation && !csrf) {
    bootstrap ??= refreshCsrf().finally(() => {
      bootstrap = undefined;
    });
    await bootstrap;
  }
  const headers = new Headers(init.headers);
  if (mutation && csrf) headers.set(csrf.header, csrf.token);
  if (typeof init.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiRequestError(response.status, body as ApiError);
  return body as ApiResponse<T>;
}
export const apiClient = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T = never>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    }),
  put: (path: string, body: unknown) =>
    apiRequest(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    apiRequest(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => apiRequest(path, { method: "DELETE" }),
};
