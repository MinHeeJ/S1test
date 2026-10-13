import { useEffect, useRef, useState } from "react";

export interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/** A failed deletion stays open; cancellation never executes the destructive callback. */
export function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "삭제하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
          if (event.key === "Tab") {
            const buttons = Array.from(
              dialog.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ) ?? [],
            );
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (
              (event.shiftKey && document.activeElement === first) ||
              (!event.shiftKey && document.activeElement === last)
            ) {
              event.preventDefault();
              (event.shiftKey ? last : first)?.focus();
            }
          }
        }}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            aria-busy={busy}
            onClick={confirm}
          >
            삭제 확인
          </button>
        </div>
      </div>
    </div>
  );
}
