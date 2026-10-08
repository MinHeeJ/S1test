import { useEffect, useRef, useState } from "react";
import { PhotoImage, photoSessionExpired } from "./PhotoImage";
import { PhotoRequestError, uploadPhoto } from "./photoApi";
import "./photos.css";

export interface PhotoPickerProps {
  photoId: string | null;
  /** Update basics.data.photoId in the current editor and enqueue its existing serialized autosave. */
  onPhotoChange: (photoId: string | null) => void;
  disabled?: boolean;
  onUnauthorized?: () => void;
}

/** SCR-RESUME-PHOTO is an editor region, not a route; it never sends a competing resume PUT. */
export function PhotoPicker({
  photoId,
  onPhotoChange,
  disabled = false,
  onUnauthorized = photoSessionExpired,
}: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
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
    if (!file || uploading.current || disabled) return;
    uploading.current = true;
    setBusy(true);
    try {
      const id = await uploadPhoto(file);
      if (mounted.current) {
        onPhotoChange(id);
        setNotice("사진이 등록되었습니다. 이력서 저장 상태를 확인하세요.");
      }
    } catch (error) {
      if (!mounted.current) return;
      setNotice(
        error instanceof Error ? error.message : "사진 업로드에 실패했습니다.",
      );
      if (error instanceof PhotoRequestError && error.status === 401)
        onUnauthorized();
    } finally {
      uploading.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section
      className="photo-picker"
      aria-label="기본정보 사진"
      aria-busy={busy}
    >
      <h3>사진</h3>
      <div className="photo-controls">
        {photoId ? (
          <PhotoImage photoId={photoId} onUnauthorized={onUnauthorized} />
        ) : (
          <button
            className="photo-placeholder photo-empty"
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
          >
            사진 등록
          </button>
        )}
        <div className="photo-actions">
          <p>JPG·PNG · 2MB 이하</p>
          {photoId && (
            <>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => input.current?.click()}
              >
                변경
              </button>
              <button
                className="photo-remove"
                type="button"
                disabled={disabled || busy}
                onClick={() => onPhotoChange(null)}
              >
                사진 삭제
              </button>
            </>
          )}
          {busy && <span role="status">사진 업로드 중…</span>}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        aria-label="사진 파일"
        accept="image/jpeg,image/png"
        hidden
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void select(file);
        }}
      />
      {notice && (
        <div className="photo-toast" role="alert">
          {notice}
        </div>
      )}
    </section>
  );
}
