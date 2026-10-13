import { apiClient, apiRequest } from "../../shared/apiClient";
import type { Resume, ResumeWrite, Template } from "../../shared/contracts";

const resource = (id: string) => `/api/resumes/${encodeURIComponent(id)}`;
export const resumesApi = {
  list: () => apiClient.get<Resume[]>("/api/resumes"),
  get: (id: string) => apiClient.get<Resume>(resource(id)),
  create: (title: string, template: Template) =>
    apiClient.post<{ id: string }>("/api/resumes", { title, template }),
  save: (id: string, snapshot: ResumeWrite) =>
    apiClient.put(resource(id), snapshot),
  rename: (id: string, title: string) =>
    apiClient.patch(resource(id), { title }),
  delete: (id: string) => apiClient.delete(resource(id)),
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/duplicate`),
  uploadPhoto: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<{ photoId: string }>("/api/photos", {
      method: "POST",
      body,
    });
  },
};
