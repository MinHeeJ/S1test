import { apiClient } from "../../api/apiClient";

export type CurrentUser = { nickname: string };
export type SignupInput = { email: string; nickname: string; password: string };
export type LoginInput = { email: string; password: string };

export const authApi = {
  me: () => apiClient.get<CurrentUser>("/api/auth/me"),
  signup: (input: SignupInput) => apiClient.post("/api/auth/signup", input),
  login: (input: LoginInput) => apiClient.post("/api/auth/login", input),
  logout: () => apiClient.post("/api/auth/logout"),
};
