import { apiRequest } from "../../shared/api";

export interface UploadedPhoto {
  photoId: string;
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const body = new FormData();
  body.append("file", file);
  const result = await apiRequest<UploadedPhoto>("/api/photos", {
    method: "POST",
    body,
    notify: false,
  });
  if (typeof result?.photoId !== "string" || !result.photoId)
    throw new Error("사진 응답을 확인하지 못했습니다.");
  return result;
}

export function getPhoto(id: string, signal?: AbortSignal): Promise<Blob> {
  return apiRequest<Blob>(`/api/photos/${encodeURIComponent(id)}`, {
    binary: true,
    notify: false,
    signal,
  });
}
