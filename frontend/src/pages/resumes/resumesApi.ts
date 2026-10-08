import { apiClient } from "../../api/apiClient";
import type { Resume } from "../../domain/resume/types";

export type ResumeUpdate = Pick<Resume, "template" | "style" | "content">;
const path = (id: string) => `/api/resumes/${encodeURIComponent(id)}`;
/** Feature depends on the shared client; the shared client never imports this module. */
export const resumesApi = {
  list: (page = 0, size = 20, filter = "") =>
    apiClient.get<Resume[]>(
      `/api/resumes?${new URLSearchParams({ page: String(page), size: String(size), filter })}`,
    ),
  get: (id: string) => apiClient.get<Resume>(path(id)),
  create: (title: string, template: Resume["template"]) =>
    apiClient.post<{ id: string }>("/api/resumes", {
      title,
      template,
    }),
  update: (id: string, body: ResumeUpdate) => apiClient.put(path(id), body),
  rename: (id: string, title: string) => apiClient.patch(path(id), { title }),
  delete: (id: string) => apiClient.delete(path(id)),
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(`${path(id)}/duplicate`),
};
