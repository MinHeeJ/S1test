import { getCurrentUser, login, logout, signup } from "../pages/auth/authApi";
import { getPhoto, photoPath, uploadPhoto } from "../pages/photos/photoApi";
import { resumeApi } from "../pages/resumes/resumeApi";

// Composition imports feature clients; features never import this registry back.
export {
  AuthApiError,
  getCurrentUser,
  login,
  logout,
  signup,
} from "../pages/auth/authApi";
export type {
  CurrentUser,
  LoginInput,
  SignupInput,
} from "../pages/auth/authApi";
export {
  getPhoto,
  photoPath,
  PhotoRequestError,
  uploadPhoto,
} from "../pages/photos/photoApi";
export {
  ResumeApiError,
  resumeApi,
  resumeRequest,
} from "../pages/resumes/resumeApi";

export const apiClient = {
  auth: { getCurrentUser, login, logout, signup },
  resumes: resumeApi,
  photos: { getPhoto, photoPath, uploadPhoto },
};
