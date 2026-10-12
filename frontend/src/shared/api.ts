export interface ApiErrorBody {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
}

export interface ApiResponse<T> {
  success: true;
  meta: Record<string, unknown>;
  data: T;
}

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.message);
  }
}

let csrfToken: string | null = null;
let bootstrap: Promise<void> | null = null;
let onUnauthorized: () => void = () => { window.location.assign('/login'); };
let onError: (message: string) => void = () => {};

export function configureApi(options: { onUnauthorized?: () => void; onError?: (message: string) => void }) {
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
  if (options.onError) onError = options.onError;
}

function captureToken(response: Response) {
  const token = response.headers.get('X-CSRF-TOKEN');
  if (token) csrfToken = token;
}

async function ensureCsrf() {
  if (csrfToken) return;
  if (!bootstrap) {
    bootstrap = fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(response => { captureToken(response); })
      .finally(() => { bootstrap = null; });
  }
  await bootstrap;
  if (!csrfToken) throw new Error('보안 토큰을 가져오지 못했습니다.');
}

/** Same-origin session requests; no automatic retries of non-idempotent commands. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  responseType: 'json' | 'blob' = 'json',
): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('상대 API 경로가 필요합니다.');
  const method = (init.method ?? 'GET').toUpperCase();
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (write) await ensureCsrf();
  const headers = new Headers(init.headers);
  if (write) headers.set('X-CSRF-TOKEN', csrfToken!);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  captureToken(response);
  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      throw new Error('서버 응답을 읽지 못했습니다.');
    }
    if (response.status === 401 && !['/api/auth/me', '/api/auth/login', '/api/auth/signup'].includes(path)) {
      csrfToken = null;
      onUnauthorized();
    }
    onError(body.message);
    throw new ApiError(response.status, body);
  }
  // Authentication changes invalidate the old session CSRF token.
  if (['/api/auth/login', '/api/auth/signup', '/api/auth/logout'].includes(path)) csrfToken = null;
  if (response.status === 204) return undefined as T;
  if (responseType === 'blob') return response.blob() as Promise<T>;
  return response.json() as Promise<T>;
}
