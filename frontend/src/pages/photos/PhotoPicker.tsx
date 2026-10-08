import { useRef, useState } from "react";
import { Toast } from "../../shared/Toast";
import { PhotoImage } from "./PhotoImage";
import { uploadPhoto } from "./photosApi";
import "./photos.css";

export type PhotoPickerProps = {
  photoId: string | null;
  /** Updates basics.data.photoId in editor memory and schedules its existing serial PUT queue. */
  onPhotoChange: (photoId: string | null) => void;
  disabled?: boolean;
};

/** SCR-RESUME-PHOTO is embedded in /resumes/:id/edit, not a separate route. */
export function PhotoPicker({
  photoId,
  onPhotoChange,
  disabled = false,
}: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");
  async function select(file?: File) {
    if (!file || uploading.current || disabled) return;
    uploading.current = true;
    setBusy(true);
    setMessage("");
    try {
      const id = await uploadPhoto(file);
      onPhotoChange(id);
      setTone("success");
      setMessage("사진이 등록되었습니다. 이력서는 자동저장됩니다.");
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "사진 업로드에 실패했습니다.",
      );
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="photo-picker"
      aria-label="기본정보 사진"
      aria-busy={busy}
    >
      <h2>사진</h2>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        aria-label="사진 파일"
        hidden
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void select(file);
        }}
      />
      <button
        type="button"
        className="photo-select"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {photoId ? <PhotoImage photoId={photoId} /> : <span>사진 등록</span>}
      </button>
      <p className="photo-hint">JPG·PNG / 2MB 이하 · 선택 즉시 업로드</p>
      {busy && <p role="status">사진 업로드 중…</p>}
      <div className="photo-actions">
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
              type="button"
              disabled={disabled || busy}
              onClick={() => onPhotoChange(null)}
            >
              사진 삭제
            </button>
          </>
        )}
      </div>
      {message && (
        <Toast message={message} tone={tone} onClose={() => setMessage("")} />
      )}
    </section>
  );
}
