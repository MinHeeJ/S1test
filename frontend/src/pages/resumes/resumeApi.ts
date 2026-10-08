import type {
  Resume,
  ResumeTemplate,
  UpdateResumeInput,
} from "../../domain/resume/types";

export class ResumeApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public field: string | null = null,
  ) {
    super(message);
  }
}

/** Uses the existing /me bootstrap, cookies and CSRF header; no browser storage is involved. */
export async function resumeRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers = new Headers();
  if (method !== "GET") {
    const bootstrap = await fetch("/api/auth/me", {
      credentials: "same-origin",
    });
    const token = bootstrap.headers.get("X-CSRF-TOKEN");
    if (token)
      headers.set(
        bootstrap.headers.get("X-CSRF-HEADER") ?? "X-CSRF-TOKEN",
        token,
      );
  }
  if (body !== undefined && !(body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const envelope = await response.json();
  if (!response.ok)
    throw new ResumeApiError(
      response.status,
      envelope.message ?? "요청에 실패했습니다.",
      envelope.field,
    );
  return envelope.data as T;
}
export const resumeApi = {
  list: (page = 0, size = 20, filter?: string) =>
    resumeRequest<Resume[]>(
      `/api/resumes?page=${page}&size=${size}${filter === undefined ? "" : `&filter=${encodeURIComponent(filter)}`}`,
    ),
  get: (id: string) =>
    resumeRequest<Resume>(`/api/resumes/${encodeURIComponent(id)}`),
  create: (title: string, template: ResumeTemplate) =>
    resumeRequest<{ id: string }>("/api/resumes", "POST", {
      title,
      template,
    }),
  rename: (id: string, title: string) =>
    resumeRequest<void>(`/api/resumes/${encodeURIComponent(id)}`, "PATCH", {
      title,
    }),
  remove: (id: string) =>
    resumeRequest<void>(`/api/resumes/${encodeURIComponent(id)}`, "DELETE"),
  duplicate: (id: string) =>
    resumeRequest<{ id: string }>(
      `/api/resumes/${encodeURIComponent(id)}/duplicate`,
      "POST",
    ),
  save: (id: string, input: UpdateResumeInput) => {
    if (new TextEncoder().encode(JSON.stringify(input)).length > 200000) {
      return Promise.reject(
        new ResumeApiError(413, "이력서 크기가 200KB를 초과합니다."),
      );
    }
    return resumeRequest<void>(
      `/api/resumes/${encodeURIComponent(id)}`,
      "PUT",
      input,
    );
  },
};
