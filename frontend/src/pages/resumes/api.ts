import { apiRequest } from "../../shared/api";
import type { Resume, ResumeWrite } from "./model";

const path = (id: string) => `/api/resumes/${encodeURIComponent(id)}`;
export const resumesApi = {
  list: () => apiRequest<Resume[]>("/api/resumes"),
  get: (id: string) => apiRequest<Resume>(path(id)),
  create: (title: string, template: string) =>
    apiRequest<{ id: string }>("/api/resumes", {
      method: "POST",
      body: JSON.stringify({ title, template }),
    }),
  save: (id: string, data: ResumeWrite) =>
    apiRequest<void>(path(id), {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rename: (id: string, title: string) =>
    apiRequest<void>(path(id), {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  remove: (id: string) => apiRequest<void>(path(id), { method: "DELETE" }),
  duplicate: (id: string) =>
    apiRequest<{ id: string }>(`${path(id)}/duplicate`, { method: "POST" }),
};
