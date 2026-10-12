import { useEffect, useRef, useState } from 'react';
import { getPhoto } from './photoApi';
import './photos.css';

export interface PhotoImageProps {
  photoId: string | null;
  alt?: string;
  onReady?: () => void;
  onError?: (message: string) => void;
}

/** Shared editor/renderer image: authenticated original bytes, 3:4 cover, no crop request. */
export function PhotoImage({ photoId, alt = '이력서 사진', onReady, onError }: PhotoImageProps) {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };

  useEffect(() => {
    if (!photoId) return;
    const controller = new AbortController();
    let url: string | null = null;
    void getPhoto(photoId, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setLoaded({ id: photoId, url });
      setFailure(null);
    }).catch(error => {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : '사진을 불러오지 못했습니다.';
      setFailure({ id: photoId, message });
      callbacks.current.onError?.(message);
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  if (!photoId) return null;
  if (failure?.id === photoId) return <p role="alert">{failure.message}</p>;
  if (loaded?.id !== photoId) return <div className="photo-loading" role="status">사진 불러오는 중…</div>;
  return (
    <img
      className="resume-photo"
      src={loaded.url}
      alt={alt}
      style={{ aspectRatio: '3 / 4', objectFit: 'cover' }}
      onLoad={() => callbacks.current.onReady?.()}
      onError={() => {
        const message = '사진을 표시하지 못했습니다.';
        setFailure({ id: photoId, message });
        callbacks.current.onError?.(message);
      }}
    />
  );
}
