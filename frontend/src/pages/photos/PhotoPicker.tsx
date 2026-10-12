import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../shared/apiClient";
import { uploadPhoto } from "./api";
import { PhotoImage } from "./PhotoImage";
import "./photos.css";

export interface PhotoPickerProps {
  photoId?: string | null;
  /** Set basics.data.photoId in the shared editor store; its existing serial autosave queue persists it. */
  onPhotoChange: (photoId: string | null) => void;
  disabled?: boolean;
  onUnauthorized?: () => void;
}

/** Editor-internal photo area at /resumes/:id/edit; upload completion is not a resume-save acknowledgement. */
export function PhotoPicker({
  photoId,
  onPhotoChange,
  disabled = false,
  onUnauthorized,
}: PhotoPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function select(file: File | undefined) {
    if (!file || disabled || busy.current) return;
    busy.current = true;
    setUploading(true);
    setToast("");
    try {
      const id = await uploadPhoto(file);
      if (mounted.current) onPhotoChange(id);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        if (onUnauthorized) onUnauthorized();
        else window.location.assign("/login");
      } else {
        setToast(
          error instanceof Error ? error.message : "사진 등록에 실패했습니다.",
        );
      }
    } finally {
      busy.current = false;
      if (mounted.current) setUploading(false);
    }
  }

  return (
    <section
      className="photo-picker"
      aria-label="기본정보 사진"
      aria-busy={uploading}
    >
      <h2>사진</h2>
      <p>JPG·PNG / 2MB 이하 · 파일 선택 후 즉시 등록</p>
      <input
        ref={input}
        type="file"
        aria-label="사진 파일"
        accept="image/jpeg,image/png"
        disabled={disabled || uploading}
        className="photo-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void select(file);
        }}
      />
      <button
        type="button"
        className="photo-select"
        disabled={disabled || uploading}
        onClick={() => input.current?.click()}
      >
        {photoId ? (
          <PhotoImage photoId={photoId} onUnauthorized={onUnauthorized} />
        ) : (
          <span>사진 등록</span>
        )}
      </button>
      <div className="photo-actions">
        {photoId && (
          <>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => input.current?.click()}
            >
              변경
            </button>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onPhotoChange(null)}
            >
              사진 삭제
            </button>
          </>
        )}
        {uploading && <span role="status">사진 업로드 중…</span>}
      </div>
      {toast && (
        <div className="photo-toast" role="alert">
          {toast}
        </div>
      )}
    </section>
  );
}
