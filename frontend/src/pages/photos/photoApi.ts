import { apiRequest } from "../../shared/apiClient";

/** Upload has no resume/user parameter: ownership comes exclusively from the authenticated session. */
export async function uploadPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await apiRequest<{ photoId: string }>("/api/photos", {
    method: "POST",
    body,
  });
  return response.data.photoId;
}

/** Private session-authenticated image URL used by both the input panel and the shared renderer. */
export function photoUrl(photoId: string): string {
  return `/api/photos/${encodeURIComponent(photoId)}`;
}
