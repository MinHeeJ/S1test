export type ApiResponse<T = never> = {
  success: true;
  meta: Record<string, unknown>;
} & ([T] extends [never] ? { data?: never } : { data: T });

export interface ApiErrorBody {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

let bootstrap: Promise<void> | undefined;

function csrfCookie(): string | undefined {
  const cookie = document.cookie
    .split("; ")
    .find((value) => value.startsWith("XSRF-TOKEN="));
  return cookie
    ? decodeURIComponent(cookie.substring("XSRF-TOKEN=".length))
    : undefined;
}

/** Materializes the Spring CSRF cookie without storing sessions or drafts in browser storage. */
export async function initializeCsrf(): Promise<void> {
  if (!bootstrap) {
    bootstrap = fetch("/api/health", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("서비스에 연결할 수 없습니다.");
      })
      .finally(() => {
        bootstrap = undefined;
      });
  }
  await bootstrap;
}

/** Relative paths only; domain callers supply selected IDs and own navigation/draft decisions. */
export async function apiRequest<T = never>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  if (!path.startsWith("/api/") || path.includes("://"))
    throw new Error("잘못된 API 경로입니다.");
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!csrfCookie()) await initializeCsrf();
    const token = csrfCookie();
    if (!token) throw new Error("보안 토큰을 가져오지 못했습니다.");
    headers.set("X-XSRF-TOKEN", token);
  }
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      success: false,
      meta: {},
      code: String(response.status),
      message: "요청을 처리할 수 없습니다.",
      field: null,
    }))) as ApiErrorBody;
    if (response.status === 401)
      window.dispatchEvent(new CustomEvent("session-expired"));
    throw new ApiError(response.status, body);
  }
  const body = (await response.json()) as ApiResponse<T>;
  if (
    method === "POST" &&
    (path === "/api/auth/login" || path === "/api/auth/signup")
  ) {
    // The server matches the trimmed, case-sensitive email. Never use nickname or retain the password.
    const input =
      typeof options.body === "string"
        ? (JSON.parse(options.body) as { email?: unknown })
        : undefined;
    if (typeof input?.email === "string") {
      window.dispatchEvent(
        new CustomEvent("session-identity", { detail: input.email.trim() }),
      );
    }
    // Authentication already succeeded and the controller issued the fresh cookie.
    // A secondary health failure must not report successful login/signup as rejected.
    // Missing cookies are still bootstrapped and enforced before the next mutation.
    await initializeCsrf().catch(() => undefined);
  }
  if (method === "POST" && path === "/api/auth/logout") {
    window.dispatchEvent(new Event("session-logged-out"));
  }
  return body;
}
