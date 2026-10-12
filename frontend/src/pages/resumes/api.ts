import { apiClient } from "../../shared/apiClient";
import type { Resume, ResumeTemplate } from "../../domain/resume/types";

export const resumeApi = {
  list: (page = 0, size = 20, filter?: string) => {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (filter !== undefined) query.set("filter", filter);
    return apiClient.get<Resume[]>(`/api/resumes?${query}`);
  },
  get: (id: string) =>
    apiClient.get<Resume>(`/api/resumes/${encodeURIComponent(id)}`),
  create: (title: string, template: ResumeTemplate) =>
    apiClient.post<{ id: string }>("/api/resumes", {
      title,
      template,
    }),
  save: (resume: Resume) =>
    apiClient.put(`/api/resumes/${encodeURIComponent(resume.id)}`, {
      template: resume.template,
      style: resume.style,
      content: resume.content,
    }),
  rename: (id: string, title: string) =>
    apiClient.patch(`/api/resumes/${encodeURIComponent(id)}`, { title }),
  remove: (id: string) =>
    apiClient.delete(`/api/resumes/${encodeURIComponent(id)}`),
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(
      `/api/resumes/${encodeURIComponent(id)}/duplicate`,
    ),
};
