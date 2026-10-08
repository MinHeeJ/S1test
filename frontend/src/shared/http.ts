export interface ApiResponse<T = undefined> {
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
    public status: number,
    public body: ApiError,
  ) {
    super(body.message);
  }
}

let csrfReady: Promise<void> | undefined;

async function prepareCsrf(): Promise<void> {
  if (
    !document.cookie
      .split("; ")
      .some((entry) => entry.startsWith("XSRF-TOKEN="))
  ) {
    csrfReady = undefined;
  }
  csrfReady ??= fetch("/api/health", { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) {
        csrfReady = undefined;
        throw new Error("서버에 연결하지 못했습니다.");
      }
    })
    .catch((error: unknown) => {
      csrfReady = undefined;
      throw error;
    });
  await csrfReady;
}

/** Same-origin JSON transport; cookie CSRF is initialized on a public safe request. */
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/api/") || path.includes("://")) {
    throw new Error("API 경로는 /api/ 상대 경로여야 합니다.");
  }
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    await prepareCsrf();
    const cookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("XSRF-TOKEN="));
    if (cookie)
      headers.set(
        "X-XSRF-TOKEN",
        decodeURIComponent(cookie.substring("XSRF-TOKEN=".length)),
      );
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
  if (!response.ok)
    throw new ApiRequestError(
      response.status,
      (await response.json()) as ApiError,
    );
  return response.json() as Promise<T>;
}
