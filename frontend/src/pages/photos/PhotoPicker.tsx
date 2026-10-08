import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../shared/http";
import { PhotoImage } from "./PhotoImage";
import { uploadPhoto } from "./photoApi";
import "./photos.css";

export interface PhotoPickerProps {
  photoId: string | null;
  /** Updates editor memory and enqueues the complete resume, without a second save queue. */
  onPhotoChange: (photoId: string | null) => void;
  /** The editor warns about unsaved changes before routing to /login. */
  onUnauthorized: () => void;
  disabled?: boolean;
}

/** SCR-RESUME-PHOTO: an embedded editor panel, not a standalone route or a saved-state indicator. */
export function PhotoPicker({
  photoId,
  onPhotoChange,
  onUnauthorized,
  disabled = false,
}: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function select(file?: File) {
    if (!file || uploading.current || disabled) return;
    uploading.current = true;
    setBusy(true);
    setMessage("");
    try {
      const id = await uploadPhoto(file);
      if (mounted.current) onPhotoChange(id);
    } catch (error: unknown) {
      if (!mounted.current) return;
      setMessage(
        error instanceof Error ? error.message : "사진을 등록하지 못했습니다.",
      );
      if (error instanceof ApiRequestError && error.status === 401)
        onUnauthorized();
    } finally {
      uploading.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section
      className="resume-photo-panel"
      aria-label="기본정보 사진"
      aria-busy={busy}
    >
      <h3>사진</h3>
      <input
        ref={input}
        className="resume-photo-file"
        type="file"
        accept="image/jpeg,image/png"
        aria-label="사진 파일 선택"
        disabled={disabled || busy}
        onChange={(event) => {
          void select(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="resume-photo-target"
        disabled={disabled || busy}
        aria-label={photoId ? "사진 변경" : "사진 등록"}
        onClick={() => input.current?.click()}
      >
        {photoId ? (
          <PhotoImage photoId={photoId} onUnauthorized={onUnauthorized} />
        ) : (
          <span>사진 등록</span>
        )}
      </button>
      <p className="resume-photo-help">JPG·PNG / 2MB 이하</p>
      {busy && <p role="status">사진 업로드 중…</p>}
      <div className="resume-photo-actions">
        {photoId && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
          >
            변경
          </button>
        )}
        <button
          type="button"
          disabled={!photoId || disabled || busy}
          onClick={() => onPhotoChange(null)}
        >
          사진 삭제
        </button>
      </div>
      {message && (
        <div className="resume-photo-toast" role="alert">
          {message}
        </div>
      )}
    </section>
  );
}
