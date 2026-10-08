import { ApiError, apiClient } from "../../api/apiClient";

export function photoUrl(id: string) {
  return `/api/photos/${encodeURIComponent(id)}`;
}

export async function uploadPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await apiClient.post<{ photoId: string }>(
    "/api/photos",
    body,
  );
  if (!response.data?.photoId)
    throw new Error("사진 업로드 응답을 확인할 수 없습니다.");
  return response.data.photoId;
}

/** Binary GET keeps the same session boundary while JSON transport remains shared. */
export async function getPhoto(
  id: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(photoUrl(id), {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new ApiError(response.status, await response.json());
  }
  return response.blob();
}
