import { useEffect, useState } from "react";
import { getPhoto } from "./photos";

/** Shared owner-only original image for the editor, thumbnails and print renderer. */
export function PhotoImage({
  photoId,
  onLoad,
}: {
  photoId: string;
  onLoad?: () => void;
}) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setFailed(null);
    getPhoto(photoId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setImage({ id: photoId, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(photoId);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  if (failed === photoId)
    return <span role="alert">사진을 불러오지 못했습니다.</span>;
  if (!image || image.id !== photoId)
    return <span role="status">사진 불러오는 중…</span>;
  return (
    <img
      src={image.url}
      alt="이력서 사진"
      onLoad={onLoad}
      onError={() => setFailed(photoId)}
      style={{
        aspectRatio: "3 / 4",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}
