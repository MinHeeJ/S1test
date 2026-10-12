import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Only this handle activates pointer/keyboard dragging, leaving field editing unaffected. */
export function ResumeSortable({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      className="sortable-wrapper"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="drag-handle secondary"
        aria-label={`${label} 순서 이동`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {children}
    </div>
  );
}
