import { request, type ApiResponse } from "../../shared/http";

export interface CurrentUser {
  nickname: string;
}
export interface SignupInput {
  email: string;
  nickname: string;
  password: string;
}
export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  signup: (input: SignupInput) =>
    request<ApiResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: LoginInput) =>
    request<ApiResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: () => request<ApiResponse>("/api/auth/logout", { method: "POST" }),
  getCurrentUser: () => request<ApiResponse<CurrentUser>>("/api/auth/me"),
};
