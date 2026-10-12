import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../shared/apiClient";
import { getPhoto } from "./api";
import "./photos.css";

export interface PhotoImageProps {
  photoId: string;
  onUnauthorized?: () => void;
}

/** Private original fetched through the session boundary; missing images never expose owner information. */
export function PhotoImage({ photoId, onUnauthorized }: PhotoImageProps) {
  const [source, setSource] = useState<{ id: string; url: string }>();
  const [failed, setFailed] = useState<string>();
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;

  useEffect(() => {
    const abort = new AbortController();
    let url: string | undefined;
    void getPhoto(photoId, abort.signal)
      .then((blob) => {
        if (abort.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setSource({ id: photoId, url });
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        setFailed(photoId);
        if (error instanceof ApiRequestError && error.status === 401) {
          if (unauthorized.current) unauthorized.current();
          else window.location.assign("/login");
        }
      });
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  if (failed === photoId)
    return <span role="status">사진을 표시할 수 없습니다.</span>;
  if (source?.id !== photoId)
    return <span role="status">사진 불러오는 중…</span>;
  return (
    <img className="resume-photo-image" src={source.url} alt="이력서 사진" />
  );
}
