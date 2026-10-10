import { useEffect, useRef, useState } from "react";
import { uploadPhoto, photoUrl } from "./photoApi";
import "./photos.css";

export interface PhotoPanelProps {
  photoId: string | null;
  /** Updates the current draft and schedules the parent's existing serial full-resume PUT queue. */
  onPhotoChange: (photoId: string | null) => void;
  disabled?: boolean;
}

/** Editor fragment for /resumes/:id/edit; never adds its own route or a competing resume save queue. */
export function PhotoPanel({
  photoId,
  onPhotoChange,
  disabled = false,
}: PhotoPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function select(file: File | undefined) {
    if (!file || inFlight.current || disabled) return;
    inFlight.current = true;
    setUploading(true);
    try {
      if (file.size > 2_000_000)
        throw new Error("사진은 2MB 이하만 가능합니다.");
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        throw new Error("JPG 또는 PNG 사진을 선택해 주세요.");
      }
      const nextId = await uploadPhoto(file);
      if (mounted.current) {
        onPhotoChange(nextId);
        setNotice("사진이 업로드되었습니다. 이력서 연결은 자동저장됩니다.");
      }
    } catch (error) {
      if (mounted.current) {
        setNotice(
          error instanceof Error
            ? error.message
            : "사진을 업로드할 수 없습니다.",
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setUploading(false);
    }
  }

  return (
    <section
      className="photo-panel"
      aria-label="기본정보 사진"
      aria-busy={uploading}
    >
      <h2>사진</h2>
      {photoId ? (
        <PhotoImage photoId={photoId} onError={setNotice} />
      ) : (
        <button
          className="photo-empty"
          type="button"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
        >
          사진 등록
          <span>JPG·PNG / 2MB 이하</span>
        </button>
      )}
      <input
        ref={input}
        className="photo-file"
        type="file"
        aria-label="사진 파일 선택"
        accept="image/jpeg,image/png"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void select(file);
        }}
      />
      <div className="photo-actions">
        {photoId && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => input.current?.click()}
          >
            변경
          </button>
        )}
        <button
          type="button"
          disabled={!photoId || disabled || uploading}
          onClick={() => onPhotoChange(null)}
        >
          사진 삭제
        </button>
      </div>
      {uploading && <p role="status">사진 업로드 중…</p>}
      {notice && (
        <div className="photo-toast" role="status">
          {notice}
        </div>
      )}
    </section>
  );
}

/** Loads private original bytes and reports image errors without rolling back the saved/draft reference. */
export function PhotoImage({
  photoId,
  onError,
}: {
  photoId: string;
  onError?: (message: string) => void;
}) {
  const [source, setSource] = useState<{ id: string; url: string }>();
  const [failed, setFailed] = useState(false);
  const callback = useRef(onError);
  callback.current = onError;
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setFailed(false);
    void fetch(photoUrl(photoId), { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 && active) {
            window.dispatchEvent(new CustomEvent("session-expired"));
          }
          throw new Error("사진을 불러올 수 없습니다.");
        }
        const blob = await response.blob();
        if (!active) return;
        url = URL.createObjectURL(blob);
        setSource({ id: photoId, url });
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          callback.current?.("사진을 불러올 수 없습니다.");
        }
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  if (failed) return <p role="alert">사진을 불러올 수 없습니다.</p>;
  if (!source || source.id !== photoId)
    return <p role="status">사진 불러오는 중…</p>;
  return (
    <img
      className="photo-image"
      src={source.url}
      alt="이력서 사진"
      onError={() => {
        setFailed(true);
        callback.current?.("사진을 불러올 수 없습니다.");
      }}
    />
  );
}
