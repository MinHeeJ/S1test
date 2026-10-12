import { useEffect, useRef } from 'react';
import type { Missing } from './model';

export function MissingFieldsModal({ missing, onClose, onFocus }: {
  missing: Missing[] | null; onClose: () => void; onFocus: (path: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (missing) dialog.current?.showModal(); else dialog.current?.close();
  }, [missing]);
  return (
    <dialog ref={dialog} onCancel={e => { e.preventDefault(); onClose(); }}>
      <h2>필수 항목을 입력해주세요</h2>
      <ul>
        {missing?.map(field => (
          <li key={field.path}><button onClick={() => onFocus(field.path)}>{field.label}</button></li>
        ))}
      </ul>
      <footer><button onClick={onClose}>닫기</button></footer>
    </dialog>
  );
}
