import { useEffect, useState } from "react";
import { getPhoto } from "./photosApi";
import "./photos.css";

/** Shared photo display for the editor and A4 renderer; never requests a null id. */
export function PhotoImage({ photoId }: { photoId: string | null }) {
  const [image, setImage] = useState<{ id: string; url: string }>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    if (!photoId) return;
    const controller = new AbortController();
    let url: string | undefined;
    let active = true;
    getPhoto(photoId, controller.signal)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({ id: photoId, url });
      })
      .catch(() => {
        if (active) setFailed(photoId);
      });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  if (!photoId) return null;
  if (failed === photoId) return <p role="alert">사진을 표시할 수 없습니다.</p>;
  if (image?.id !== photoId) return <p role="status">사진 불러오는 중…</p>;
  return <img className="resume-photo" src={image.url} alt="이력서 사진" />;
}
