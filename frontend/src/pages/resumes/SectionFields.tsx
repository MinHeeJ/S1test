import { useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ResumeSection } from "../../domain/resume/types";
import { fields, fieldLabels, firstFields, newItem, warning } from "./content";

export function SortableResumeRow({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const sortable = useSortable({ id });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
      <button
        ref={sortable.setActivatorNodeRef}
        aria-label="순서 변경"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        ↕
      </button>
      {children}
    </div>
  );
}

function InputFields({
  type,
  row,
  prefix,
  change,
}: {
  type: string;
  row: Record<string, unknown>;
  prefix: string;
  change: (key: string, value: string | boolean) => void;
}) {
  return (
    <div className="resumes-fields">
      {(fields[type] ?? []).map((key) => {
        const value = String(row[key] ?? "");
        const error = warning(key, value, row);
        const required =
          type === "basics"
            ? ["name", "jobTitle", "email"].includes(key)
            : key === firstFields[type];
        const label =
          key === "current"
            ? type === "education"
              ? "재학중"
              : "재직중"
            : key === "start"
              ? "시작일"
              : key === "end"
                ? "종료일"
                : key === "name" && type === "projects"
                  ? "프로젝트명"
                  : key === "name" && type === "certificates"
                    ? "자격증명"
                    : fieldLabels[key];
        return (
          <label key={key}>
            <span>
              {label}
              {required && (
                <span className="resumes-required" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </span>
            {key === "current" ? (
              <input
                id={`${prefix}-${key}`}
                aria-label={label}
                type="checkbox"
                checked={!!row[key]}
                onChange={(event) => change(key, event.target.checked)}
              />
            ) : key === "degree" ? (
              <select
                id={`${prefix}-${key}`}
                aria-label={label}
                value={value}
                onChange={(event) => change(key, event.target.value)}
              >
                {["", "고졸", "학사", "석사", "박사"].map((degree) => (
                  <option value={degree} key={degree}>
                    {degree}
                  </option>
                ))}
              </select>
            ) : ["body", "description"].includes(key) ? (
              <textarea
                id={`${prefix}-${key}`}
                aria-label={label}
                value={value}
                rows={5}
                onChange={(event) => change(key, event.target.value)}
                onKeyDown={(event) => {
                  if (key === "description" && event.key === "Enter") {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const start = input.selectionStart;
                    change(
                      key,
                      `${value.slice(0, start)}\n- ${value.slice(input.selectionEnd)}`,
                    );
                    requestAnimationFrame(() =>
                      input.setSelectionRange(start + 3, start + 3),
                    );
                  }
                }}
              />
            ) : (
              <input
                id={`${prefix}-${key}`}
                aria-label={label}
                value={value}
                placeholder={
                  ["start", "end", "date"].includes(key) ? "YYYY.MM" : undefined
                }
                disabled={key === "end" && !!row.current}
                aria-invalid={!!error}
                onChange={(event) => change(key, event.target.value)}
              />
            )}
            {error && <small className="resumes-warning">{error}</small>}
          </label>
        );
      })}
      {type === "summary" && (
        <small>{Array.from(String(row.body ?? "")).length}자</small>
      )}
    </div>
  );
}

export function SectionFields({
  section,
  change,
  expanded,
  setExpanded,
  photoControl,
}: {
  section: ResumeSection;
  change: (section: ResumeSection) => void;
  expanded?: string;
  setExpanded: (id?: string) => void;
  photoControl?: (
    photoId: string | null,
    onChange: (id: string | null) => void,
  ) => ReactNode;
}) {
  const latest = useRef({ section, change });
  latest.current = { section, change };
  const [buffer, setBuffer] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  if (section.type === "skills") {
    const tags = section.data.tags ?? [];
    function addTags() {
      const added = Array.from(
        new Set([
          ...tags,
          ...buffer
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ]),
      );
      if (added.length > 30) return;
      change({ ...section, data: { tags: added } } as ResumeSection);
      setBuffer("");
    }
    return (
      <div>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() =>
              change({
                ...section,
                data: { tags: tags.filter((t) => t !== tag) },
              })
            }
          >
            {tag} ×
          </button>
        ))}
        <label>
          기술 태그
          <input
            value={buffer}
            onChange={(event) => setBuffer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTags();
              }
            }}
          />
        </label>
        <small>{tags.length} / 30</small>
      </div>
    );
  }
  if ("data" in section) {
    const row = section.data as unknown as Record<string, unknown>;
    return (
      <>
        <InputFields
          type={section.type}
          prefix={section.type}
          row={row}
          change={(key, value) =>
            change({
              ...section,
              data: { ...section.data, [key]: value },
            } as ResumeSection)
          }
        />
        {section.type === "basics" && (
          <>
            {(section.data.links ?? []).map((link, index) => (
              <div className="resumes-link" key={index}>
                {(["label", "url"] as const).map((key) => (
                  <label key={key}>
                    {key === "label" ? "링크 이름" : "URL"}
                    <input
                      value={link[key] ?? ""}
                      onChange={(event) => {
                        const links = section.data.links.map((entry, i) =>
                          i === index
                            ? { ...entry, [key]: event.target.value }
                            : entry,
                        );
                        change({
                          ...section,
                          data: { ...section.data, links },
                        });
                      }}
                    />
                  </label>
                ))}
                <button
                  onClick={() =>
                    change({
                      ...section,
                      data: {
                        ...section.data,
                        links: section.data.links.filter((_, i) => i !== index),
                      },
                    })
                  }
                >
                  링크 삭제
                </button>
              </div>
            ))}
            <button
              disabled={(section.data.links?.length ?? 0) >= 3}
              onClick={() =>
                change({
                  ...section,
                  data: {
                    ...section.data,
                    links: [
                      ...(section.data.links ?? []),
                      { label: "", url: "" },
                    ],
                  },
                })
              }
            >
              링크 추가
            </button>
            {photoControl?.(section.data.photoId, (photoId) => {
              const current = latest.current.section;
              if (current.type === "basics") {
                latest.current.change({
                  ...current,
                  data: { ...current.data, photoId },
                });
              }
            })}
            {section.data.photoId && !photoControl && (
              <button
                onClick={() =>
                  change({
                    ...section,
                    data: { ...section.data, photoId: null },
                  })
                }
              >
                사진 삭제
              </button>
            )}
          </>
        )}
      </>
    );
  }
  const items = section.items;
  function update(index: number, key: string, value: unknown) {
    change({
      ...section,
      items: items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    } as ResumeSection);
  }
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const from = items.findIndex((item) => item.id === active.id);
        const to = items.findIndex((item) => item.id === over.id);
        if (from >= 0 && to >= 0) {
          change({
            ...section,
            items: arrayMove<(typeof items)[number]>(items, from, to),
          } as ResumeSection);
        }
      }}
    >
      <SortableContext items={items.map((item) => item.id)}>
        {items.map((item, index) => {
          const row = item as unknown as Record<string, unknown>;
          return (
            <SortableResumeRow id={item.id} key={item.id}>
              <button
                onClick={() =>
                  setExpanded(expanded === item.id ? undefined : item.id)
                }
              >
                {String(row[firstFields[section.type]] || "(제목 없음)")}
                {[
                  "position",
                  "major",
                  "role",
                  "issuer",
                  "test",
                  "score",
                  "start",
                  "end",
                ]
                  .filter((key) => row[key] || (key === "end" && row.current))
                  .map(
                    (key) =>
                      ` · ${key === "end" && row.current ? "현재" : row[key]}`,
                  )
                  .join("")}
              </button>
              <button
                disabled={items.length >= 20}
                onClick={() => {
                  const duplicate = { ...item, id: crypto.randomUUID() };
                  change({
                    ...section,
                    items: [...items, duplicate],
                  } as ResumeSection);
                  setExpanded(duplicate.id);
                }}
              >
                항목 복제
              </button>
              <button
                onClick={() =>
                  change({
                    ...section,
                    items: items.filter((_, i) => i !== index),
                  } as ResumeSection)
                }
              >
                항목 삭제
              </button>
              {expanded === item.id && (
                <InputFields
                  type={section.type}
                  prefix={item.id}
                  row={row}
                  change={(key, value) => update(index, key, value)}
                />
              )}
            </SortableResumeRow>
          );
        })}
      </SortableContext>
      <button
        disabled={items.length >= 20}
        onClick={() => {
          const item = newItem(section.type);
          change({
            ...section,
            items: [...items, item],
          } as unknown as ResumeSection);
          setExpanded(String(item.id));
          requestAnimationFrame(() =>
            document
              .getElementById(`${item.id}-${firstFields[section.type]}`)
              ?.focus(),
          );
        }}
      >
        + 항목 추가
      </button>
    </DndContext>
  );
}
