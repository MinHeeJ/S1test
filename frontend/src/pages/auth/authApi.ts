import { apiRequest } from "../../shared/apiClient";

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

export const getCurrentUser = () => apiRequest<CurrentUser>("/api/auth/me");
export const login = (input: LoginInput) =>
  apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const signup = (input: SignupInput) =>
  apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const logout = () => apiRequest("/api/auth/logout", { method: "POST" });
