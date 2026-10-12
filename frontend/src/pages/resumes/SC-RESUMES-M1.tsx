import { useEffect, useRef, useState } from 'react';
import type { Resume } from './model';

export function CreateResumeModal({ open, pending, onCancel, onCreate }: {
  open: boolean; pending: boolean; onCancel: () => void;
  onCreate: (title: string, template: Resume['template']) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('새 이력서');
  const [template, setTemplate] = useState<Resume['template']>('classic');
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open]);
  return (
    <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!pending) onCancel(); }}>
      <form onSubmit={e => { e.preventDefault(); if (!pending) void onCreate(title, template); }}>
        <h2>새 이력서</h2>
        <label>제목<input value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>템플릿
          <select value={template} onChange={e => setTemplate(e.target.value as Resume['template'])}>
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
          </select>
        </label>
        <footer>
          <button type="button" disabled={pending} onClick={onCancel}>취소</button>
          <button className="primary" disabled={pending} aria-busy={pending}>생성</button>
        </footer>
      </form>
    </dialog>
  );
}
