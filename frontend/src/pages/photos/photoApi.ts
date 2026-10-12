import { apiRequest, type ApiResponse } from '../../shared/api';

export interface UploadedPhoto {
  photoId: string;
}

/** Upload only; connecting the returned ID remains the editor's full-snapshot save. */
export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const body = new FormData();
  body.append('file', file);
  const response = await apiRequest<ApiResponse<UploadedPhoto>>('/api/photos', { method: 'POST', body });
  if (!response.success || typeof response.data?.photoId !== 'string') {
    throw new Error('사진 업로드 응답을 확인할 수 없습니다.');
  }
  return response.data;
}

export function photoUrl(photoId: string): string {
  return `/api/photos/${encodeURIComponent(photoId)}`;
}

/** Read via the common session/error boundary rather than bypassing 401 handling with an img URL. */
export async function getPhoto(photoId: string, signal?: AbortSignal): Promise<Blob> {
  const blob = await apiRequest<Blob>(photoUrl(photoId), { signal }, 'blob');
  if (!['image/jpeg', 'image/png'].includes(blob.type)) {
    throw new Error('사진 응답 형식을 확인할 수 없습니다.');
  }
  return blob;
}
