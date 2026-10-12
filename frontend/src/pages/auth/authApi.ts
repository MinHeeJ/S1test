import { apiClient, refreshCsrf } from "../../shared/apiClient";

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

export const getCurrentUser = async (): Promise<CurrentUser> => {
  const response = await apiClient.get<CurrentUser>("/api/auth/me");
  if (!response.data) throw new Error("사용자 정보를 확인하지 못했습니다.");
  return response.data;
};
export async function login(input: LoginInput): Promise<void> {
  await apiClient.post("/api/auth/login", input);
  await refreshCsrf();
}
export async function signup(input: SignupInput): Promise<void> {
  await apiClient.post("/api/auth/signup", input);
  await refreshCsrf();
}
export async function logout(): Promise<void> {
  await apiClient.post("/api/auth/logout");
  await refreshCsrf();
}
