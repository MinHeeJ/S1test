import { useRef, useState } from "react";
import { useToast } from "../../shared/Toast";
import { PhotoImage } from "./PhotoImage";
import { uploadPhoto } from "./photos";
import "./photos.css";

export interface PhotoInputProps {
  photoId: string | null;
  onChange: (photoId: string | null) => void;
  disabled?: boolean;
}

/** Changes the draft only; its parent schedules the existing serial whole-resume save. */
export function PhotoInput({
  photoId,
  onChange,
  disabled = false,
}: PhotoInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  async function select(file?: File) {
    if (!file || disabled || uploading.current) return;
    uploading.current = true;
    setBusy(true);
    try {
      const uploaded = await uploadPhoto(file);
      onChange(uploaded.photoId);
      useToast
        .getState()
        .show("사진을 등록했습니다. 이력서 저장을 기다려 주세요.");
    } catch (error) {
      useToast
        .getState()
        .show(
          error instanceof Error
            ? error.message
            : "사진을 등록하지 못했습니다.",
        );
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="photo-input" aria-busy={busy}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        aria-label="사진 파일"
        disabled={disabled || busy}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void select(file);
        }}
      />
      <button
        type="button"
        className="photo-select"
        aria-label={photoId ? "사진 변경" : "사진 등록"}
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {photoId ? <PhotoImage photoId={photoId} /> : <span>사진 등록</span>}
      </button>
      <span className="photo-help">JPG·PNG, 2MB 이하</span>
      {busy && <span role="status">사진 업로드 중…</span>}
      {photoId && (
        <div className="photo-actions">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
          >
            변경
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => onChange(null)}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
