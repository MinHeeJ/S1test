/** Public client registry reuses the single session/CSRF transport without reverse feature imports. */
export * from "../shared/apiClient";
export { login, signup, confirmSession } from "../pages/auth/authApi";
export type { LoginRequest, SignupRequest } from "../pages/auth/authApi";
export { resumesApi } from "../pages/resumes/resumesApi";
export { uploadPhoto, photoUrl } from "../pages/photos/photoApi";
export type { UploadedPhoto } from "../pages/photos/photoApi";
