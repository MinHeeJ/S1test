/** Application-facing registry reuses feature clients and the single same-origin CSRF transport. */
export {
  apiClient,
  apiRequest,
  ApiRequestError,
  refreshCsrf,
} from "../shared/apiClient";
export type { ApiResponse, ApiError } from "../shared/apiClient";
export { login, signup, logout, getCurrentUser } from "../pages/auth/authApi";
export type {
  CurrentUser,
  LoginInput,
  SignupInput,
} from "../pages/auth/authApi";
export { resumeApi } from "../pages/resumes/api";
export { uploadPhoto, getPhoto, photoUrl } from "../pages/photos/api";
