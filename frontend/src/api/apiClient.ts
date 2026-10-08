import { request, type ApiResponse } from "../shared/http";

// Registry imports features, while features import only shared/http to avoid dependency cycles.
export { authApi } from "../pages/auth/authApi";
export type {
  CurrentUser,
  LoginInput,
  SignupInput,
} from "../pages/auth/authApi";
export { resumeApi, resumeInput } from "../pages/resumes/resumeApi";
export type { ResumeInput } from "../pages/resumes/resumeApi";
export {
  uploadPhoto,
  getPhoto,
  photoUrl,
  withPhoto,
} from "../pages/photos/photoApi";
export { request, ApiRequestError } from "../shared/http";
export type { ApiError, ApiResponse } from "../shared/http";

export const healthApi = {
  getHealth: () => request<ApiResponse>("/api/health"),
};
