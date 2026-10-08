import { request, type ApiResponse } from "../../shared/http";
import type { Resume } from "../../domain/resume/types";

export type ResumeInput = Pick<Resume, "template" | "style" | "content"> & {
  title?: string;
};
const path = (id: string) => `/api/resumes/${encodeURIComponent(id)}`;
export const resumeApi = {
  async list(page = 0, size = 20, filter?: string): Promise<Resume[]> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (filter !== undefined) query.set("filter", filter);
    return (await request<ApiResponse<Resume[]>>(`/api/resumes?${query}`))
      .data!;
  },
  async all(filter?: string): Promise<Resume[]> {
    const rows: Resume[] = [];
    for (let page = 0; ; page++) {
      const next = await this.list(page, 100, filter);
      rows.push(...next);
      if (next.length < 100) return rows;
    }
  },
  async get(id: string): Promise<Resume> {
    return (await request<ApiResponse<Resume>>(path(id))).data!;
  },
  async create(title: string, template: Resume["template"]): Promise<string> {
    return (
      await request<ApiResponse<{ id: string }>>("/api/resumes", {
        method: "POST",
        body: JSON.stringify({ title, template }),
      })
    ).data!.id;
  },
  async rename(id: string, title: string): Promise<void> {
    await request(path(id), {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  async remove(id: string): Promise<void> {
    await request(path(id), { method: "DELETE" });
  },
  async duplicate(id: string): Promise<string> {
    return (
      await request<ApiResponse<{ id: string }>>(`${path(id)}/duplicate`, {
        method: "POST",
      })
    ).data!.id;
  },
  async save(id: string, input: ResumeInput): Promise<void> {
    await request(path(id), { method: "PUT", body: JSON.stringify(input) });
  },
};
export function resumeInput(resume: Resume): ResumeInput {
  return {
    template: resume.template,
    style: resume.style,
    content: resume.content,
  };
}
