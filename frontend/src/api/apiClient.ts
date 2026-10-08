export type ApiResponse<T = unknown> = {
  success: true;
  meta: Record<string, unknown>;
  data?: T;
};
export type ApiErrorBody = {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
  get code() {
    return this.body.code;
  }
  get field() {
    return this.body.field;
  }
}
let csrfToken: string | undefined;
let bootstrap: Promise<void> | undefined;
let unauthorized: () => void = () => window.location.assign("/login");

/** 세션 만료 화면 이동은 공통 route 소유자가 설정한다. */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorized = handler;
}
function rememberToken(response: Response) {
  const token = response.headers.get("X-CSRF-TOKEN");
  if (token) csrfToken = token;
}
/** 무세션401에서도 token을 먼저 읽는다. bootstrap에는 일반401 redirect를 적용하지 않는다. */
export function initializeCsrf(): Promise<void> {
  if (bootstrap) return bootstrap;
  bootstrap = fetch("/api/auth/me", { credentials: "same-origin" })
    .then((response) => {
      rememberToken(response);
      if (!csrfToken) throw new Error("CSRF 초기화에 실패했습니다.");
    })
    .finally(() => {
      bootstrap = undefined;
    });
  return bootstrap;
}

/** 상대 /api 경로만 사용하고 JSON과 multipart 요청에 동일한 CSRF 경계를 적용한다. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("Relative API path required");
  const method = (options.method ?? "GET").toUpperCase();
  const write = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (write && !csrfToken) await initializeCsrf();
  const headers = new Headers(options.headers);
  if (write && csrfToken) headers.set("X-CSRF-TOKEN", csrfToken);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });
  rememberToken(response);
  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/api/auth/me" &&
      path !== "/api/auth/login"
    )
      unauthorized();
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {
        success: false,
        meta: {},
        code: "BAD_REQUEST",
        message: "요청에 실패했습니다.",
        field: null,
      };
    }
    throw new ApiError(response.status, body);
  }
  if (
    path === "/api/auth/login" ||
    path === "/api/auth/signup" ||
    path === "/api/auth/logout"
  ) {
    // The authenticated session may rotate its CSRF token. Bootstrap again before the next write.
    csrfToken = undefined;
  }
  return response.json() as Promise<ApiResponse<T>>;
}
export const apiClient = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};
