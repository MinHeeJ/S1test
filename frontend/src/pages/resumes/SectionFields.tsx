import { useEffect, useState } from "react";
import type { ResumeSection } from "../../domain/resume/types";
import { PhotoPicker } from "../photos/PhotoPicker";
import { emptyItem, itemFields, labels, warning } from "./resumeRules";

type Fields = Record<string, string | boolean>;
function Field({
  field,
  value,
  onChange,
  path,
  current,
  start,
  section,
}: {
  field: string;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  path: string;
  current?: boolean;
  start?: string;
  section?: string;
}) {
  const message = warning(field, String(value ?? ""), start);
  const label =
    section === "projects" && field === "name"
      ? "프로젝트명"
      : section === "certificates" && field === "name"
        ? "자격증명"
        : labels[field];
  if (field === "current")
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {section === "education" ? "재학중" : "재직중"}
      </label>
    );
  return (
    <label>
      {label}
      {field === "degree" ? (
        <select
          id={path}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        >
          {["", "고졸", "학사", "석사", "박사"].map((degree) => (
            <option key={degree} value={degree}>
              {degree || "선택"}
            </option>
          ))}
        </select>
      ) : ["body", "description"].includes(field) ? (
        <textarea
          id={path}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (field !== "description" || event.key !== "Enter") return;
            event.preventDefault();
            const input = event.currentTarget;
            const position = input.selectionStart;
            const text = String(value ?? "");
            onChange(
              `${text.slice(0, position)}\n- ${text.slice(input.selectionEnd)}`,
            );
            requestAnimationFrame(() => {
              input.selectionStart = input.selectionEnd = position + 3;
            });
          }}
          rows={5}
        />
      ) : (
        <input
          id={path}
          value={String(value ?? "")}
          disabled={field === "end" && current}
          aria-label={label}
          aria-describedby={message ? `${path}.warning` : undefined}
          aria-invalid={Boolean(message)}
          placeholder={
            ["start", "end", "date"].includes(field) ? "YYYY.MM" : undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {message && (
        <span id={`${path}.warning`} className="field-warning">
          {message}
        </span>
      )}
    </label>
  );
}

/** Type-specific fields preserve optional JSON data and keep warnings separate from save validation. */
export function SectionFields({
  section,
  index,
  change,
  focusPath,
}: {
  section: ResumeSection;
  index: number;
  change: (section: ResumeSection) => void;
  onError: (message: string) => void;
  focusPath?: string;
}) {
  const [openItem, setOpenItem] = useState<string>();
  const [tag, setTag] = useState("");
  useEffect(() => {
    if (!focusPath?.startsWith(`content.${index}.`)) return;
    const row = Number(focusPath.split(".")[3]);
    if (
      "items" in section &&
      section.items[row] &&
      openItem !== section.items[row].id
    ) {
      setOpenItem(section.items[row].id);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const input = document.getElementById(focusPath);
      if (!input) return;
      let parent = input.parentElement;
      while (parent) {
        if (parent.tagName === "DETAILS")
          (parent as HTMLDetailsElement).open = true;
        parent = parent.parentElement;
      }
      input.focus();
      input.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusPath, index, section, openItem]);
  if (section.type === "basics") {
    const data = section.data;
    return (
      <div className="fields-grid">
        {(["name", "jobTitle", "email", "phone"] as const).map((field) => (
          <Field
            key={field}
            field={field}
            value={data[field] ?? ""}
            path={`content.${index}.data.${field}`}
            onChange={(value) =>
              change({ ...section, data: { ...data, [field]: value } })
            }
          />
        ))}
        {(data.links ?? []).map((link, row) => (
          <div className="link-fields" key={row}>
            {(["label", "url"] as const).map((field) => (
              <label key={field}>
                {field === "label" ? "라벨" : "URL"}
                <input
                  value={link[field]}
                  onChange={(event) =>
                    change({
                      ...section,
                      data: {
                        ...data,
                        links: data.links.map((link, i) =>
                          i === row
                            ? { ...link, [field]: event.target.value }
                            : link,
                        ),
                      },
                    })
                  }
                />
              </label>
            ))}
            <button
              onClick={() =>
                change({
                  ...section,
                  data: {
                    ...data,
                    links: data.links.filter((_, i) => i !== row),
                  },
                })
              }
            >
              링크 삭제
            </button>
          </div>
        ))}
        <button
          disabled={(data.links ?? []).length >= 3}
          onClick={() =>
            change({
              ...section,
              data: {
                ...data,
                links: [...(data.links ?? []), { label: "", url: "" }],
              },
            })
          }
        >
          링크 추가
        </button>
        <PhotoPicker
          photoId={data.photoId}
          onPhotoChange={(photoId) =>
            change({ ...section, data: { ...data, photoId } })
          }
        />
      </div>
    );
  }
  if (section.type === "summary")
    return (
      <div className="fields-grid">
        {(["headline", "body"] as const).map((field) => (
          <Field
            key={field}
            field={field}
            value={section.data[field] ?? ""}
            path={`content.${index}.data.${field}`}
            onChange={(value) =>
              change({ ...section, data: { ...section.data, [field]: value } })
            }
          />
        ))}
        <span>{Array.from(section.data.body ?? "").length}자</span>
      </div>
    );
  if (section.type === "skills") {
    const tags = section.data.tags ?? [];
    const addTag = () => {
      const value = tag.trim();
      if (value && tags.length < 30 && !tags.includes(value))
        change({ ...section, data: { tags: [...tags, value] } });
      setTag("");
    };
    return (
      <div>
        <div className="skill-tags">
          {tags.map((value) => (
            <button
              key={value}
              onClick={() =>
                change({
                  ...section,
                  data: { tags: tags.filter((tag) => tag !== value) },
                })
              }
            >
              {value} ×
            </button>
          ))}
        </div>
        <label>
          기술 태그 (최대 30개)
          <input
            value={tag}
            disabled={tags.length >= 30}
            onChange={(event) => setTag(event.target.value)}
            onKeyDown={(event) => {
              if (["Enter", ","].includes(event.key)) {
                event.preventDefault();
                addTag();
              }
            }}
          />
        </label>
      </div>
    );
  }
  const items = section.items;
  const updateItems = (next: Array<(typeof items)[number]>) =>
    change({ ...section, items: next } as ResumeSection);
  return (
    <div className="fields-grid">
      {items.map((item, row) => {
        const values = item as unknown as Fields;
        const fields = itemFields[section.type];
        return (
          <div
            className="item-fields"
            key={item.id}
            draggable
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.setData("text/plain", `item:${row}`);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const source = event.dataTransfer.getData("text/plain");
              if (!source.startsWith("item:")) return;
              const from = Number(source.slice(5));
              if (from < 0 || from >= items.length) return;
              const next = [...items];
              const [moved] = next.splice(from, 1);
              next.splice(row, 0, moved);
              updateItems(next);
            }}
          >
            <button
              onClick={() =>
                setOpenItem(openItem === item.id ? undefined : item.id)
              }
            >
              {String(values[fields[0]] || "(제목 없음)")} ·{" "}
              {String(values[fields[1]] || "")} ·
              {String(values.start || values.date || values.score || "")}
              {values.start &&
                ` — ${values.current ? "현재" : values.end || ""}`}
            </button>
            <button
              disabled={items.length >= 20}
              onClick={() =>
                updateItems([
                  ...items,
                  { ...item, id: crypto.randomUUID() },
                ] as typeof items)
              }
            >
              항목 복제
            </button>
            <button
              onClick={() => updateItems(items.filter((_, i) => i !== row))}
            >
              항목 삭제
            </button>
            {openItem === item.id && (
              <div className="fields-grid">
                {fields.map((field) => (
                  <Field
                    key={field}
                    field={field}
                    section={section.type}
                    value={values[field] ?? (field === "current" ? false : "")}
                    current={Boolean(values.current)}
                    start={String(values.start ?? "")}
                    path={`content.${index}.items.${row}.${field}`}
                    onChange={(value) =>
                      updateItems(
                        items.map((item, i) =>
                          i === row ? { ...item, [field]: value } : item,
                        ) as typeof items,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button
        disabled={items.length >= 20}
        onClick={() => {
          const item = emptyItem(section.type);
          updateItems([...items, item] as typeof items);
          setOpenItem(String(item.id));
        }}
      >
        + 항목 추가 ({items.length}/20)
      </button>
    </div>
  );
}
