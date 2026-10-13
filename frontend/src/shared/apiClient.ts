import type { ApiError, ApiResponse } from "./contracts";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
  }
}

type Listener = (error: ApiRequestError) => void;
let unauthorized: Listener = () => {
  if (window.location.pathname !== "/login") window.location.assign("/login");
};
let notifyError: Listener = () => undefined;
export function configureApiClient(handlers: {
  onUnauthorized?: Listener;
  onError?: Listener;
}) {
  if (handlers.onUnauthorized) unauthorized = handlers.onUnauthorized;
  if (handlers.onError) notifyError = handlers.onError;
}

function csrfCookie(): string | undefined {
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("XSRF-TOKEN="));
  return value
    ? decodeURIComponent(value.slice("XSRF-TOKEN=".length))
    : undefined;
}

/** Public GET bootstrap is shared with health; never invent a CSRF endpoint or cache credentials. */
export async function bootstrapCsrf(): Promise<void> {
  const response = await fetch("/api/health", { credentials: "same-origin" });
  if (!response.ok) throw new Error("서비스 연결을 확인해 주세요.");
}

/** Unwraps typed data, preserves errors and never parses a bodyless 204 or retries mutations. */
export async function apiRequest<T = void>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("상대 API 경로만 허용됩니다.");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!csrfCookie()) await bootstrapCsrf();
    const token = csrfCookie();
    if (!token) throw new Error("보안 토큰을 확인하지 못했습니다.");
    headers.set("X-XSRF-TOKEN", token);
  }
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "same-origin",
  });
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const body: ApiError = await response.json().catch(() => ({
      success: false,
      meta: {},
      code: String(response.status),
      message: "요청을 처리하지 못했습니다.",
      field: null,
    }));
    const error = new ApiRequestError(response.status, body);
    if (
      response.status === 401 &&
      !["/api/auth/login", "/api/auth/signup"].includes(path)
    )
      unauthorized(error);
    notifyError(error);
    throw error;
  }
  const body: ApiResponse<T> = await response.json();
  if (body.success !== true || !body.meta || !("data" in body))
    throw new Error("응답 계약을 확인해 주세요.");
  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T = void>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: (path: string, body: unknown) =>
    apiRequest<void>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    apiRequest<void>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => apiRequest<void>(path, { method: "DELETE" }),
};
