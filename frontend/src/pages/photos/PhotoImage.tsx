import { useEffect, useRef, useState } from "react";
import { getPhoto, PhotoRequestError } from "./photoApi";
import "./photos.css";

export function photoSessionExpired(): void {
  window.alert(
    "세션이 만료되었습니다. 저장되지 않은 변경 사항이 있을 수 있습니다.",
  );
  window.location.assign("/login");
}

/** Private binary loading shared by the input area and the A4 renderer; missing images never expose bytes. */
export function PhotoImage({
  photoId,
  onUnauthorized = photoSessionExpired,
}: {
  photoId: string;
  onUnauthorized?: () => void;
}) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setFailed(null);
    void getPhoto(photoId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setImage({ id: photoId, url });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setFailed(photoId);
        if (error instanceof PhotoRequestError && error.status === 401)
          unauthorized.current();
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  if (failed === photoId)
    return (
      <span className="photo-placeholder">사진을 불러올 수 없습니다.</span>
    );
  if (image?.id !== photoId)
    return (
      <span role="status" className="photo-placeholder">
        사진 불러오는 중…
      </span>
    );
  return (
    <img
      className="photo-image"
      src={image.url}
      alt="이력서 사진"
      onError={() => setFailed(photoId)}
    />
  );
}
