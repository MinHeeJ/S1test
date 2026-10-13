import { apiRequest } from "../../services/apiClient";

export interface UploadedPhoto {
  photoId: string;
}

/** Multipart upload is never retried; the editor owns the separate resume save queue. */
export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const body = new FormData();
  body.append("file", file);
  const photo = await apiRequest<UploadedPhoto>("/api/photos", {
    method: "POST",
    body,
  });
  if (typeof photo?.photoId !== "string" || !photo.photoId)
    throw new Error("사진 응답을 확인해 주세요.");
  return photo;
}

export function photoUrl(photoId: string): string {
  return `/api/photos/${encodeURIComponent(photoId)}`;
}
