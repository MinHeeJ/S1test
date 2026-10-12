import { useCallback, useRef, useState } from 'react';
import { Toast } from '../../shared/Toast';
import { uploadPhoto } from './photoApi';
import { PhotoImage } from './PhotoImage';
import './photos.css';

export interface PhotoEditorProps {
  photoId: string | null;
  /** Update basics.data.photoId and schedule the existing serial autosave; do not start a parallel PUT. */
  onPhotoIdChange: (photoId: string | null) => void;
  disabled?: boolean;
}

/** Basic-information photo controls, mounted by the owning editor on /resumes/:id/edit. */
export function PhotoEditor({ photoId, onPhotoIdChange, disabled = false }: PhotoEditorProps) {
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dismiss = useCallback(() => setMessage(null), []);

  async function select(file?: File) {
    if (!file || disabled || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      const uploaded = await uploadPhoto(file);
      onPhotoIdChange(uploaded.photoId);
      setMessage('사진을 업로드했습니다. 이력서에 연결하여 저장합니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '사진을 업로드하지 못했습니다.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section className="photo-editor" aria-label="기본정보 사진" aria-busy={pending}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        aria-label="사진 파일"
        hidden
        disabled={disabled || pending}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void select(file);
        }}
      />
      <button
        type="button"
        className="photo-select"
        disabled={disabled || pending}
        onClick={() => input.current?.click()}
        aria-label={photoId ? '사진 변경' : '사진 등록'}
      >
        {photoId ? <PhotoImage photoId={photoId} /> : <span>사진 등록</span>}
      </button>
      <p className="photo-hint">JPG·PNG, 2MB 이하 · 선택하면 즉시 업로드</p>
      {pending && <p role="status">사진 업로드 중…</p>}
      {photoId && (
        <div className="photo-actions">
          <button type="button" disabled={disabled || pending} onClick={() => input.current?.click()}>
            변경
          </button>
          <button type="button" disabled={disabled || pending} onClick={() => onPhotoIdChange(null)}>
            삭제
          </button>
        </div>
      )}
      <Toast message={message} onDismiss={dismiss} />
    </section>
  );
}
