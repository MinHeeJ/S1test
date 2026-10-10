import { apiRequest } from "../../shared/apiClient";
import type {
  Resume,
  ResumeContent,
  ResumeStyle,
  ResumeTemplate,
} from "../../domain/resume/types";

export interface ResumeInput {
  template: ResumeTemplate;
  style: ResumeStyle;
  content: ResumeContent;
}
const path = (id: string) => `/api/resumes/${encodeURIComponent(id)}`;
export const resumesApi = {
  list: (page = 0, size = 20) =>
    apiRequest<Resume[]>(`/api/resumes?page=${page}&size=${size}`),
  get: (id: string) => apiRequest<Resume>(path(id)),
  create: (title: string, template: ResumeTemplate) =>
    apiRequest<{ id: string }>("/api/resumes", {
      method: "POST",
      body: JSON.stringify({ title, template }),
    }),
  update: (id: string, input: ResumeInput) =>
    apiRequest(path(id), {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  rename: (id: string, title: string) =>
    apiRequest(path(id), {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  duplicate: (id: string) =>
    apiRequest<{ id: string }>(`${path(id)}/duplicate`, { method: "POST" }),
  delete: (id: string) => apiRequest(path(id), { method: "DELETE" }),
};
