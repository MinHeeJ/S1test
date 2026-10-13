import { apiRequest, bootstrapCsrf } from "../../shared/apiClient";
import { useSessionStore } from "../../app/sessionStore";

export interface LoginRequest {
  email: string;
  password: string;
}
export interface SignupRequest extends LoginRequest {
  nickname: string;
}

export const login = (input: LoginRequest) =>
  apiRequest<void>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const signup = (input: SignupRequest) =>
  apiRequest<void>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });

/** After session rotation get a new CSRF cookie, then confirm the actual server identity. */
export async function confirmSession(): Promise<void> {
  await bootstrapCsrf();
  await useSessionStore.getState().refresh();
  const session = useSessionStore.getState();
  if (session.status !== "authenticated")
    throw new Error(session.error ?? "사용자를 확인하지 못했습니다.");
}
