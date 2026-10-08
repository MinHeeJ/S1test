import { useEffect, useState } from "react";
import { ApiRequestError } from "../../shared/http";
import { getPhoto } from "./photoApi";
import "./photos.css";

export interface PhotoImageProps {
  photoId: string;
  onUnauthorized: () => void;
}

/** Shared 3:4 cover image for the photo panel and the resume renderer. */
export function PhotoImage({ photoId, onUnauthorized }: PhotoImageProps) {
  const [image, setImage] = useState<{ id: string; url: string }>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setFailed(undefined);
    void getPhoto(photoId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setImage({ id: photoId, url });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFailed(photoId);
        if (error instanceof ApiRequestError && error.status === 401)
          onUnauthorized();
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId, onUnauthorized]);
  if (failed === photoId)
    return <span role="alert">사진을 표시할 수 없습니다.</span>;
  if (image?.id !== photoId)
    return <span role="status">사진 불러오는 중…</span>;
  return (
    <img
      className="resume-photo-image"
      src={image.url}
      alt="이력서 사진"
      onError={() => setFailed(photoId)}
    />
  );
}
