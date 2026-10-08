import { useEffect, useId, useRef, type ReactNode } from "react";

/** Browser modal semantics keep keyboard focus inside and restore the opener on close. */
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="product-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          aria-label="닫기"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
