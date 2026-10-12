import { apiClient, ApiRequestError } from "../../shared/apiClient";

export function photoUrl(photoId: string): string {
  return `/api/photos/${encodeURIComponent(photoId)}`;
}

export async function uploadPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const result = await apiClient.post<{ photoId: string }>("/api/photos", body);
  if (!result.data?.photoId)
    throw new Error("사진 등록 결과를 확인하지 못했습니다.");
  return result.data.photoId;
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
    throw new ApiRequestError(response.status, await response.json());
  return response.blob();
}
