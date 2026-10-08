import {
  ApiRequestError,
  request,
  type ApiError,
  type ApiResponse,
} from "../../shared/http";
import type { Resume } from "../../domain/resume/types";

export async function uploadPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await request<ApiResponse<{ photoId: string }>>(
    "/api/photos",
    { method: "POST", body },
  );
  if (!response.data?.photoId)
    throw new Error("사진 업로드 응답을 확인하지 못했습니다.");
  return response.data.photoId;
}

export function photoUrl(photoId: string): string {
  return `/api/photos/${encodeURIComponent(photoId)}`;
}

export async function getPhoto(
  photoId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(photoUrl(photoId), {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok)
    throw new ApiRequestError(
      response.status,
      (await response.json()) as ApiError,
    );
  return response.blob();
}

/** Changes only the reference; the editor submits this through its existing serial autosave queue. */
export function withPhoto(resume: Resume, photoId: string | null): Resume {
  return {
    ...resume,
    content: resume.content.map((section) =>
      section.type === "basics"
        ? { ...section, data: { ...section.data, photoId } }
        : section,
    ),
  };
}
