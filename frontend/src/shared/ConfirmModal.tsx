import { useEffect, useRef, type ReactNode } from 'react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, children, pending = false, onConfirm, onCancel }: ConfirmModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirmation-title"
      onCancel={event => { event.preventDefault(); if (!pending) onCancel(); }}
    >
      <h2 id="confirmation-title">{title}</h2>
      {children}
      <footer>
        <button type="button" onClick={onCancel} disabled={pending}>취소</button>
        <button className="danger" type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>
          삭제
        </button>
      </footer>
    </dialog>
  );
}
