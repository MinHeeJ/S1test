import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ResumeSection } from "../../domain/resume/types";
import {
  emptyItem,
  fieldNames,
  itemFields,
  sectionNames,
  warning,
} from "./resumeEditing";

export function ResumeSortable({
  id,
  children,
  disabled = false,
}: {
  id: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      disabled,
    });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {!disabled && (
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label="순서 이동"
        >
          ↕
        </button>
      )}
      {children}
    </div>
  );
}
export function ResumeFields({
  data,
  fields,
  path,
  change,
  required = [],
}: {
  data: Record<string, unknown>;
  fields: string[];
  path: string;
  required?: string[];
  change: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="resume-fields">
      {fields.map((field) => {
        const value = data[field] ?? (field === "current" ? false : "");
        const warn = warning(field, String(value), data);
        const id = `${path}.${field}`;
        const update = (value: unknown) => change({ ...data, [field]: value });
        return (
          <label key={field} htmlFor={id}>
            {fieldNames[field]}
            {required.includes(field) && (
              <small aria-hidden="true"> (필수)</small>
            )}
            {field === "current" ? (
              <input
                type="checkbox"
                id={id}
                aria-label={fieldNames[field]}
                aria-required={required.includes(field) || undefined}
                checked={!!value}
                onChange={(event) => update(event.target.checked)}
              />
            ) : field === "degree" ? (
              <select
                id={id}
                aria-label={fieldNames[field]}
                aria-required={required.includes(field) || undefined}
                value={String(value)}
                onChange={(event) => update(event.target.value)}
              >
                {["", "고졸", "학사", "석사", "박사"].map((degree) => (
                  <option key={degree} value={degree}>
                    {degree || "선택 안 함"}
                  </option>
                ))}
              </select>
            ) : ["description", "body"].includes(field) ? (
              <textarea
                id={id}
                aria-label={fieldNames[field]}
                aria-required={required.includes(field) || undefined}
                value={String(value)}
                onChange={(event) => update(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    field === "description" &&
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const position = input.selectionStart;
                    const next =
                      String(value).slice(0, position) +
                      "\n- " +
                      String(value).slice(input.selectionEnd);
                    update(next);
                    requestAnimationFrame(() => {
                      input.selectionStart = input.selectionEnd = position + 3;
                    });
                  }
                }}
              />
            ) : (
              <input
                id={id}
                aria-label={fieldNames[field]}
                aria-required={required.includes(field) || undefined}
                value={String(value)}
                disabled={field === "end" && !!data.current}
                placeholder={
                  ["start", "end", "date"].includes(field)
                    ? "YYYY.MM"
                    : undefined
                }
                aria-describedby={warn ? `${id}-warning` : undefined}
                aria-invalid={!!warn}
                onChange={(event) => update(event.target.value)}
              />
            )}
            {warn && (
              <small id={`${id}-warning`} className="field-warning">
                {warn}
              </small>
            )}
            {field === "body" && (
              <small>{Array.from(String(value)).length}자</small>
            )}
          </label>
        );
      })}
    </div>
  );
}

export function ResumeSectionFields({
  section,
  index,
  change,
  renderItems,
  focusPath,
}: {
  section: ResumeSection;
  index: number;
  focusPath?: string;
  change: (section: ResumeSection) => void;
  renderItems: (items: ReactNode, ids: string[]) => ReactNode;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const path = `content.${index}`;
  useEffect(() => {
    if (!focusPath?.startsWith(`${path}.`)) return;
    const match = focusPath.match(/\.items\.(\d+)\./);
    if (match && "items" in section) {
      setExpanded(section.items[Number(match[1])]?.id ?? null);
    }
  }, [focusPath, path, section]);
  useEffect(() => {
    if (!focusPath?.startsWith(`${path}.`)) return;
    const frame = requestAnimationFrame(() => {
      const field = document.getElementById(focusPath);
      field?.scrollIntoView?.({ block: "center" });
      field?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded, focusPath, path]);
  if (section.type === "skills") {
    const tags = section.data.tags ?? [];
    const add = () => {
      const next = tag.trim();
      if (next && tags.length < 30 && !tags.includes(next))
        change({ ...section, data: { tags: [...tags, next] } });
      setTag("");
    };
    return (
      <div>
        {tags.map((value, i) => (
          <button
            key={i}
            onClick={() =>
              change({
                ...section,
                data: { tags: tags.filter((_, index) => index !== i) },
              })
            }
          >
            {value} ×
          </button>
        ))}
        <label>
          기술 태그
          <input
            value={tag}
            disabled={tags.length >= 30}
            onChange={(event) => setTag(event.target.value)}
            onKeyDown={(event) => {
              if (
                !event.nativeEvent.isComposing &&
                (event.key === "Enter" || event.key === ",")
              ) {
                event.preventDefault();
                add();
              }
            }}
          />
        </label>
      </div>
    );
  }
  if (section.type === "basics" || section.type === "summary") {
    return (
      <>
        <ResumeFields
          data={section.data as unknown as Record<string, unknown>}
          fields={
            section.type === "basics"
              ? ["name", "jobTitle", "email", "phone"]
              : ["headline", "body"]
          }
          required={
            section.type === "basics" ? ["name", "jobTitle", "email"] : []
          }
          path={`${path}.data`}
          change={(data) =>
            change({ ...section, data } as unknown as ResumeSection)
          }
        />
        {section.type === "basics" && (
          <div>
            {(section.data.links ?? []).map((link, i) => (
              <div key={i}>
                <label>
                  링크 이름
                  <input
                    value={link.label ?? ""}
                    onChange={(e) =>
                      change({
                        ...section,
                        data: {
                          ...section.data,
                          links: section.data.links.map((l, j) =>
                            j === i ? { ...l, label: e.target.value } : l,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  링크 주소
                  <input
                    value={link.url ?? ""}
                    onChange={(e) =>
                      change({
                        ...section,
                        data: {
                          ...section.data,
                          links: section.data.links.map((l, j) =>
                            j === i ? { ...l, url: e.target.value } : l,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    change({
                      ...section,
                      data: {
                        ...section.data,
                        links: section.data.links.filter((_, j) => j !== i),
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
          </div>
        )}
      </>
    );
  }
  const items = section.items;
  const replace = (updated: unknown[]) =>
    change({ ...section, items: updated } as ResumeSection);
  return (
    <>
      {renderItems(
        items.map((item, i) => (
          <ResumeSortable key={item.id} id={item.id}>
            <div className="resume-item">
              <button
                aria-expanded={expanded === item.id}
                onClick={() =>
                  setExpanded(expanded === item.id ? null : item.id)
                }
              >
                {(() => {
                  const data = item as unknown as Record<string, unknown>;
                  const fields = itemFields[section.type]!;
                  const period = data.current
                    ? [data.start, "현재"].filter(Boolean).join(" ~ ")
                    : [data.start, data.end].filter(Boolean).join(" ~ ");
                  return [
                    data[fields[0]] || "(제목 없음)",
                    data[fields[1]],
                    period || data.date,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                })()}
              </button>
              <button
                disabled={items.length >= 20}
                onClick={() =>
                  replace([
                    ...items.slice(0, i + 1),
                    { ...item, id: crypto.randomUUID() },
                    ...items.slice(i + 1),
                  ])
                }
              >
                항목 복제
              </button>
              <button onClick={() => replace(items.filter((_, j) => j !== i))}>
                항목 삭제
              </button>
              {expanded === item.id && (
                <ResumeFields
                  data={item as unknown as Record<string, unknown>}
                  fields={itemFields[section.type]!}
                  required={[itemFields[section.type]![0]]}
                  path={`${path}.items.${i}`}
                  change={(updated) =>
                    replace(
                      items.map((existing, j) =>
                        j === i ? updated : existing,
                      ),
                    )
                  }
                />
              )}
            </div>
          </ResumeSortable>
        )),
        items.map((item) => item.id),
      )}
      <button
        disabled={items.length >= 20}
        onClick={() => {
          const item = emptyItem(section.type);
          replace([...items, item]);
          setExpanded(item.id as string);
        }}
      >
        + 항목 추가 ({items.length}/20)
      </button>
      <small>
        {sectionNames[section.type]} 필수값은 완성도와 PDF 내보내기에만
        사용합니다.
      </small>
    </>
  );
}
