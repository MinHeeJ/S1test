import { apiRequest } from "../../shared/api";
import { useSessionStore, type CurrentUser } from "../../app/session";

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
    notify: false,
  });
export const signup = (input: SignupRequest) =>
  apiRequest<void>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
    notify: false,
  });
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await apiRequest<CurrentUser>("/api/auth/me", { notify: false });
  if (typeof user?.nickname !== "string" || !user.nickname.trim()) {
    throw new Error("사용자 응답을 확인하지 못했습니다.");
  }
  return user;
}

/** Editor passes its serialized flush; no logout request occurs if saving fails. */
export async function logout(flush?: () => Promise<void>): Promise<void> {
  if (flush) await flush();
  await apiRequest<void>("/api/auth/logout", { method: "POST", notify: false });
  useSessionStore.getState().clear();
}
