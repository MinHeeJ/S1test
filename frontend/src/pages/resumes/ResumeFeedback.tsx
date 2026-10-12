import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function Toast({
  message,
  clear,
}: {
  message: string;
  clear: () => void;
}) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(clear, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, clear]);
  return message ? (
    <div className="resume-toast" role="status">
      {message}
    </div>
  ) : null;
}
export function ResumeDialog({
  title,
  busy = false,
  cancel,
  children,
}: {
  title: string;
  busy?: boolean;
  cancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("input, button, select")?.focus();
    return () => prior?.focus();
  }, []);
  return (
    <div className="resume-scrim">
      <div
        className="resume-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            cancel();
          }
          if (event.key === "Tab") {
            const controls = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
              ) ?? [],
            );
            const index = controls.indexOf(
              document.activeElement as HTMLElement,
            );
            if (
              (event.shiftKey && index <= 0) ||
              (!event.shiftKey && index === controls.length - 1)
            ) {
              event.preventDefault();
              controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
            }
          }
        }}
      >
        <h2>{title}</h2>
        {children}
        <button className="secondary" disabled={busy} onClick={cancel}>
          취소
        </button>
      </div>
    </div>
  );
}
