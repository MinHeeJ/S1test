import { apiRequest } from "../shared/api";
import { login, signup, getCurrentUser, logout } from "../pages/auth/authApi";
import { resumesApi } from "../pages/resumes/api";
import { uploadPhoto, getPhoto } from "../pages/photos/photos";

export {
  ApiError,
  apiRequest,
  configureApiEvents,
  refreshCsrf,
} from "../shared/api";
export {
  login,
  signup,
  getCurrentUser,
  logout,
  resumesApi,
  uploadPhoto,
  getPhoto,
};

/** Developer health check shares the session transport without inventing response data. */
export const getHealth = () =>
  apiRequest<void>("/api/health", { notify: false });

/** Registry imports feature clients; feature clients only import the shared transport, never this registry. */
export const apiClient = {
  signup,
  login,
  logout,
  getCurrentUser,
  listResumes: resumesApi.list,
  createResume: resumesApi.create,
  getResume: resumesApi.get,
  saveResume: resumesApi.save,
  renameResume: resumesApi.rename,
  deleteResume: resumesApi.remove,
  duplicateResume: resumesApi.duplicate,
  uploadPhoto,
  getPhoto,
  getHealth,
};
