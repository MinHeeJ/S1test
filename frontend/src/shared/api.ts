export interface ApiResponse<T> {
  success: true;
  meta: Record<string, unknown>;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

let unauthorized: () => void = () => window.location.assign("/login");
let notifyError: (message: string) => void = () => undefined;

export function configureApiEvents(events: {
  unauthorized: () => void;
  error: (message: string) => void;
}) {
  unauthorized = events.unauthorized;
  notifyError = events.error;
}

/** Refresh via real public HTML, not an invented CSRF API or browser-persisted credentials. */
export async function refreshCsrf(): Promise<void> {
  const response = await fetch("/", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error("요청을 준비하지 못했습니다.");
}

function csrfToken(): string | undefined {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="));
  return cookie
    ? decodeURIComponent(cookie.substring("XSRF-TOKEN=".length))
    : undefined;
}

/** Returns undefined for 204 and raw Blob for photos; only JSON responses are unwrapped. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit & { binary?: boolean; notify?: boolean } = {},
): Promise<T> {
  if (!path.startsWith("/api/"))
    throw new Error("상대 API 경로만 사용할 수 있습니다.");
  const { binary, notify = true, ...init } = options;
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!csrfToken()) await refreshCsrf();
    const token = csrfToken();
    if (!token) throw new Error("요청 토큰을 확인하지 못했습니다.");
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
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
      if (
        body.success !== false ||
        typeof body.message !== "string" ||
        typeof body.code !== "string"
      )
        throw new Error();
    } catch {
      body = {
        success: false,
        meta: {},
        code: "INVALID_RESPONSE",
        message: "요청을 처리하지 못했습니다.",
        field: null,
      };
    }
    if (
      response.status === 401 &&
      !["/api/auth/login", "/api/auth/signup", "/api/auth/me"].includes(path)
    ) {
      unauthorized();
    }
    if (notify) notifyError(body.message);
    throw new ApiError(response.status, body);
  }
  if (
    ["/api/auth/login", "/api/auth/signup", "/api/auth/logout"].includes(
      path,
    ) &&
    method === "POST"
  ) {
    await refreshCsrf();
  }
  if (response.status === 204) return undefined as T;
  if (binary) return (await response.blob()) as T;
  const envelope = (await response.json()) as ApiResponse<T>;
  if (
    envelope.success !== true ||
    typeof envelope.meta !== "object" ||
    envelope.meta === null
  ) {
    throw new Error("응답 계약을 확인하지 못했습니다.");
  }
  return envelope.data;
}
