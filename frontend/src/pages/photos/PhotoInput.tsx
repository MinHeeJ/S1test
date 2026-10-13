import { useRef, useState } from "react";
import { useToastStore } from "../../shared/Toast";
import { PhotoImage } from "./PhotoImage";
import { uploadPhoto } from "./photoApi";
import "./photos.css";

export interface PhotoInputProps {
  photoId: string | null;
  onChange: (photoId: string | null) => void;
  disabled?: boolean;
}

/** onChange updates the latest editor snapshot and its existing serial autosave queue. */
export function PhotoInput({
  photoId,
  onChange,
  disabled = false,
}: PhotoInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const blocked = disabled || busy;

  async function select(file?: File) {
    if (!file || inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const uploaded = await uploadPhoto(file);
      // Only POST rejection preserves the old id. Later PUT failure must keep this new dirty snapshot.
      onChange(uploaded.photoId);
      setSuccess(true);
      useToastStore
        .getState()
        .show("사진이 업로드되었습니다. 이력서 저장을 기다려 주세요.");
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "사진을 등록하지 못했습니다.";
      setError(message);
      useToastStore.getState().show(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="photo-input">
      <span className="photo-label">사진</span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        aria-label="사진 파일 선택"
        hidden
        disabled={blocked}
        onChange={(event) => {
          void select(event.target.files?.[0]);
        }}
      />
      <button
        type="button"
        className="photo-select"
        aria-label={photoId ? "사진 변경" : "사진 등록"}
        aria-busy={busy}
        disabled={blocked}
        onClick={() => input.current?.click()}
      >
        {photoId ? <PhotoImage photoId={photoId} /> : <span>사진 등록</span>}
      </button>
      <span className="photo-help">JPG·PNG, 2MB 이하 · 선택 즉시 업로드</span>
      {photoId && (
        <div className="photo-actions">
          <button
            type="button"
            disabled={blocked}
            onClick={() => input.current?.click()}
          >
            변경
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => {
              onChange(null);
              setSuccess(false);
              setError(null);
              useToastStore
                .getState()
                .show(
                  "사진 연결이 해제되었습니다. 이력서 저장을 기다려 주세요.",
                );
            }}
          >
            삭제
          </button>
        </div>
      )}
      {busy && <span role="status">사진 업로드 중…</span>}
      {!photoId && !busy && (
        <span className="photo-help">등록된 사진이 없습니다.</span>
      )}
      {success && (
        <span role="status">사진 업로드 완료 · 이력서 저장 대기</span>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
