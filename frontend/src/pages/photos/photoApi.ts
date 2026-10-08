export const MAX_PHOTO_BYTES = 2_000_000;

export class PhotoRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  const error = await response.json().catch(() => null);
  throw new PhotoRequestError(
    response.status,
    error?.code ?? response.statusText,
    error?.message ?? "사진 요청에 실패했습니다.",
  );
}

/** Uses the existing /me token bootstrap; browser cookies and CSRF remain authoritative. */
export async function uploadPhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoRequestError(
      413,
      "FILE_TOO_LARGE",
      "사진 크기는 2MB 이하여야 합니다.",
    );
  }
  // /me may return 401 with a token for anonymous users. The mutation still enforces authentication.
  const bootstrap = await fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const token = bootstrap.headers.get("X-CSRF-TOKEN");
  const header = bootstrap.headers.get("X-CSRF-HEADER") ?? "X-CSRF-TOKEN";
  if (!token) {
    throw new PhotoRequestError(
      bootstrap.status,
      "Unauthorized",
      "세션을 확인할 수 없습니다.",
    );
  }
  const body = new FormData();
  body.append("file", file);
  const response = await check(
    await fetch("/api/photos", {
      method: "POST",
      credentials: "same-origin",
      headers: { [header]: token },
      body,
    }),
  );
  const envelope = await response.json();
  if (envelope.success !== true || typeof envelope.data?.photoId !== "string") {
    throw new Error("사진 응답을 확인할 수 없습니다.");
  }
  return envelope.data.photoId;
}

export function photoPath(id: string): string {
  return `/api/photos/${encodeURIComponent(id)}`;
}

export async function getPhoto(
  id: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await check(
    await fetch(photoPath(id), { credentials: "same-origin", signal }),
  );
  return response.blob();
}
