import { useEffect, useId, useRef, type ReactNode } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};
/** Native modal로 focus 제한, Escape 취소 및 닫힌 뒤 focus 복귀를 제공한다. */
export function ConfirmDialog({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      <footer>
        <button disabled={busy} onClick={onCancel} autoFocus>
          취소
        </button>
        <button
          className="danger"
          disabled={busy}
          aria-busy={busy}
          onClick={onConfirm}
        >
          삭제
        </button>
      </footer>
    </dialog>
  );
}
