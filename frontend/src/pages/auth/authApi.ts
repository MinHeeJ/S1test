export interface CurrentUser {
  nickname: string;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface SignupInput extends LoginInput {
  nickname: string;
}
interface Envelope<T> {
  success: boolean;
  meta: Record<string, unknown>;
  data: T;
}

/** Flat contract error; no credential or server diagnostic is copied into UI state. */
export class AuthApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field: string | null,
  ) {
    super(message);
  }
}

async function read<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new AuthApiError(
      response.status,
      body.code,
      body.message,
      body.field ?? null,
    );
  }
  return body as T;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
  });
  return (await read<Envelope<CurrentUser>>(response)).data;
}

/** Bootstrap even for anonymous users and renew after login's CSRF rotation. */
async function mutate(
  path: string,
  input?: LoginInput | SignupInput,
): Promise<void> {
  const bootstrap = await fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!bootstrap.ok && bootstrap.status !== 401) await read(bootstrap);
  const token = bootstrap.headers.get("X-CSRF-TOKEN");
  const header = bootstrap.headers.get("X-CSRF-HEADER") ?? "X-CSRF-TOKEN";
  if (!token)
    throw new Error("보안 확인을 완료하지 못했습니다. 다시 시도해 주세요.");
  await read(
    await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", [header]: token },
      body: input === undefined ? undefined : JSON.stringify(input),
    }),
  );
}

export async function login(input: LoginInput): Promise<CurrentUser> {
  await mutate("/api/auth/login", input);
  return getCurrentUser();
}

export async function signup(input: SignupInput): Promise<CurrentUser> {
  await mutate("/api/auth/signup", input);
  return getCurrentUser();
}

export async function logout(): Promise<void> {
  await mutate("/api/auth/logout");
}
