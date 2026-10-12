import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PhotoInput } from "../photos/PhotoInput";
import {
  codePointCount,
  dateWarning,
  emailValid,
  itemFields,
  labels,
  newItem,
  sectionNames,
  type Item,
  type Section,
  type SectionData,
} from "./model";

function Field({
  id,
  field,
  value,
  onChange,
  warning,
  disabled = false,
  label = labels[field],
}: {
  id: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
  warning?: string | null;
  disabled?: boolean;
  label?: string;
}) {
  const multiline = field === "body" || field === "description";
  return (
    <label htmlFor={id}>
      {label}
      {multiline ? (
        <textarea
          id={id}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (field !== "description" || event.key !== "Enter") return;
            event.preventDefault();
            const input = event.currentTarget;
            const start = input.selectionStart;
            onChange(
              `${value.slice(0, start)}\n- ${value.slice(input.selectionEnd)}`,
            );
            requestAnimationFrame(() =>
              input.setSelectionRange(start + 3, start + 3),
            );
          }}
        />
      ) : (
        <input
          id={id}
          aria-label={label}
          value={value}
          disabled={disabled}
          placeholder={
            ["start", "end", "date"].includes(field) ? "YYYY.MM" : undefined
          }
          aria-invalid={!!warning}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field === "body" && <small>{codePointCount(value)}자</small>}
      {warning && <span className="field-error">{warning}</span>}
    </label>
  );
}

function ResumeItemCard({
  item,
  section,
  open,
  onOpen,
  onChange,
  onDuplicate,
  onDelete,
  full,
}: {
  item: Item;
  section: Section;
  open: boolean;
  onOpen: () => void;
  onChange: (item: Item) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  full: boolean;
}) {
  const drag = useSortable({ id: item.id });
  const fields = itemFields[section.type] ?? [];
  const summary = String(item[fields[0]] || "(제목 없음)");
  const period =
    "start" in item
      ? ` · ${item.start} – ${item.current ? "현재" : item.end}`
      : "";
  return (
    <article
      ref={drag.setNodeRef}
      className="resume-item"
      style={{
        transform: drag.transform
          ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`
          : undefined,
        transition: drag.transition,
      }}
    >
      <div className="section-actions">
        <button
          type="button"
          aria-label="항목 정렬"
          {...drag.attributes}
          {...drag.listeners}
        >
          ↕
        </button>
        <button type="button" aria-expanded={open} onClick={onOpen}>
          {summary} · {String(item[fields[1]] ?? "")}
          {period}
        </button>
      </div>
      {open && (
        <div className="field-grid">
          {fields.map((field) =>
            field === "current" ? (
              <label className="current-control" key={field}>
                <input
                  type="checkbox"
                  checked={!!item.current}
                  onChange={(event) =>
                    onChange({ ...item, current: event.target.checked })
                  }
                />
                {section.type === "education" ? "재학중" : "재직중"}
              </label>
            ) : field === "degree" ? (
              <label key={field}>
                학위
                <select
                  value={String(item.degree)}
                  onChange={(event) =>
                    onChange({ ...item, degree: event.target.value })
                  }
                >
                  {["", "고졸", "학사", "석사", "박사"].map((degree) => (
                    <option key={degree} value={degree}>
                      {degree}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Field
                key={field}
                id={`${section.type}-${item.id}-${field}`}
                field={field}
                label={
                  field === "name"
                    ? section.type === "projects"
                      ? "프로젝트명"
                      : "자격증명"
                    : labels[field]
                }
                value={String(item[field])}
                disabled={field === "end" && !!item.current}
                warning={
                  field === "end" && item.current
                    ? null
                    : dateWarning(field, item)
                }
                onChange={(value) => onChange({ ...item, [field]: value })}
              />
            ),
          )}
          <div className="section-actions">
            <button type="button" disabled={full} onClick={onDuplicate}>
              항목 복제
            </button>
            <button type="button" onClick={onDelete}>
              항목 삭제
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function SectionFields({
  section,
  onChange,
}: {
  section: Section;
  onChange: (section: Section) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    section.items?.[0]?.id ?? null,
  );
  const [tag, setTag] = useState("");
  const latest = useRef(section);
  latest.current = section;
  const data = section.data ?? {};
  const updateData = (value: Partial<SectionData>) =>
    onChange({
      ...latest.current,
      data: { ...latest.current.data, ...value },
    });
  useEffect(() => {
    const focus = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      const item = latest.current.items?.find((entry) =>
        path.startsWith(`${section.type}-${entry.id}-`),
      );
      if (item) setExpanded(item.id);
    };
    window.addEventListener("resume-focus-field", focus);
    return () => window.removeEventListener("resume-focus-field", focus);
  }, [section.type]);
  const addTag = () => {
    const value = tag.trim();
    if (value && (data.tags?.length ?? 0) < 30 && !data.tags?.includes(value)) {
      updateData({ tags: [...(data.tags ?? []), value] });
    }
    setTag("");
  };
  if (section.type === "basics")
    return (
      <div className="field-grid">
        {(["name", "jobTitle", "email", "phone"] as const).map((field) => (
          <Field
            key={field}
            id={`basics-${field}`}
            field={field}
            value={data[field] ?? ""}
            warning={
              field === "email" && data.email && !emailValid(data.email)
                ? "이메일 형식을 확인해 주세요."
                : null
            }
            onChange={(value) => updateData({ [field]: value })}
          />
        ))}
        <fieldset className="links-fields">
          <legend>링크</legend>
          {(data.links ?? []).map((link, index) => (
            <div className="field-grid" key={index}>
              {(["label", "url"] as const).map((field) => (
                <label key={field}>
                  {field === "label" ? "링크 이름" : "URL"}
                  <input
                    value={link[field]}
                    onChange={(event) =>
                      updateData({
                        links: data.links!.map((entry, i) =>
                          i === index
                            ? { ...entry, [field]: event.target.value }
                            : entry,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateData({
                    links: data.links!.filter((_, i) => i !== index),
                  })
                }
              >
                링크 삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={(data.links?.length ?? 0) >= 3}
            onClick={() =>
              updateData({
                links: [...(data.links ?? []), { label: "", url: "" }],
              })
            }
          >
            링크 추가
          </button>
        </fieldset>
        <PhotoInput
          photoId={data.photoId ?? null}
          onChange={(photoId) => updateData({ photoId })}
        />
      </div>
    );
  if (section.type === "summary")
    return (
      <div className="field-grid">
        {(["headline", "body"] as const).map((field) => (
          <Field
            key={field}
            id={`summary-${field}`}
            field={field}
            value={data[field] ?? ""}
            onChange={(value) => updateData({ [field]: value })}
          />
        ))}
      </div>
    );
  if (section.type === "skills")
    return (
      <div>
        <label>
          기술 태그
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTag();
              }
            }}
          />
        </label>
        <p className="helper">
          Enter·쉼표로 추가 · 최대 30개
          {data.tags?.length === 30 ? " (상한 도달)" : ""}
        </p>
        <div className="tag-list">
          {data.tags?.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() =>
                updateData({
                  tags: data.tags!.filter((entry) => entry !== value),
                })
              }
            >
              {value} ×
            </button>
          ))}
        </div>
      </div>
    );
  const items = section.items ?? [];
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const from = items.findIndex((item) => item.id === active.id);
        const to = items.findIndex((item) => item.id === over.id);
        onChange({ ...section, items: arrayMove(items, from, to) });
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.length === 0 && <p>등록된 항목이 없습니다.</p>}
        {items.map((item) => (
          <ResumeItemCard
            key={item.id}
            item={item}
            section={section}
            open={expanded === item.id}
            full={items.length >= 20}
            onOpen={() => setExpanded(expanded === item.id ? null : item.id)}
            onChange={(updated) =>
              onChange({
                ...section,
                items: items.map((entry) =>
                  entry.id === item.id ? updated : entry,
                ),
              })
            }
            onDuplicate={() => {
              if (items.length >= 20) return;
              const copy = { ...item, id: crypto.randomUUID() };
              const next = [...items];
              next.splice(items.indexOf(item) + 1, 0, copy);
              onChange({ ...section, items: next });
              setExpanded(copy.id);
            }}
            onDelete={() =>
              onChange({
                ...section,
                items: items.filter((entry) => entry.id !== item.id),
              })
            }
          />
        ))}
      </SortableContext>
      <button
        type="button"
        disabled={items.length >= 20}
        onClick={() => {
          if (items.length >= 20) return;
          const item = newItem(section.type);
          onChange({ ...section, items: [...items, item] });
          setExpanded(item.id);
        }}
      >
        ＋ {sectionNames[section.type]} 항목 추가
      </button>
    </DndContext>
  );
}
