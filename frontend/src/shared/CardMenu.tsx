import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function CardMenu({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>(".card-actions button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="card-menu"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
        if (!["ArrowDown", "ArrowUp"].includes(event.key) || !open) return;
        event.preventDefault();
        const controls = Array.from(
          root.current!.querySelectorAll<HTMLButtonElement>(
            ".card-actions button",
          ),
        );
        const position = controls.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          (position + (event.key === "ArrowDown" ? 1 : -1) + controls.length) %
          controls.length;
        controls[next]?.focus();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="menu-trigger"
        aria-label={`${title} 작업`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div id={id} className="card-actions" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
