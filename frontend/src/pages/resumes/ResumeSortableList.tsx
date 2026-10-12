import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button className="drag-handle" aria-label="순서 변경" {...attributes} {...listeners}>⠿</button>
      {children}
    </div>
  );
}
export function ResumeSortableList({ ids, onMove, children }: {
  ids: string[]; onMove: (from: number, to: number) => void; children: (id: string, index: number) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }));
  return (
    <DndContext sensors={sensors} onDragEnd={({ active, over }) => {
      if (over && over.id !== active.id) onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ids.map((id, index) => <SortableRow id={id} key={id}>{children(id, index)}</SortableRow>)}
      </SortableContext>
    </DndContext>
  );
}
