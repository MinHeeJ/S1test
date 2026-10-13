import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Content,
  Section,
  SectionType,
  BasicsData,
} from "../../shared/contracts";
import { ConfirmModal } from "../../shared/ConfirmModal";
import { useToastStore } from "../../shared/Toast";
import { resumesApi } from "./resumesApi";
import {
  dateWarning,
  emailValid,
  fieldLabels,
  itemFields,
  newItem,
  newSection,
  sectionLabels,
} from "./content";
import type { MissingField } from "./content";

function Sortable({
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
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="drag-handle"
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

export function DescriptionInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <textarea
        id={id}
        value={value}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const { selectionStart, selectionEnd } = event.currentTarget;
          onChange(
            `${value.slice(0, selectionStart)}\n- ${value.slice(selectionEnd)}`,
          );
          const input = event.currentTarget;
          requestAnimationFrame(() =>
            input.setSelectionRange(selectionStart + 3, selectionStart + 3),
          );
        }}
      />
    </label>
  );
}

function Field({
  id,
  field,
  value,
  onChange,
  disabled,
  start,
}: {
  id: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  start?: string;
}) {
  const warning =
    field === "email" && value && !emailValid(value)
      ? "이메일 형식을 확인해 주세요."
      : ["start", "end", "date"].includes(field)
        ? dateWarning(value, field === "end" ? start : undefined)
        : null;
  return (
    <div
      className={
        ["body", "description", "name", "jobTitle", "headline"].includes(field)
          ? "wide-field"
          : ""
      }
    >
      {field === "description" ? (
        <DescriptionInput
          id={id}
          label={fieldLabels[field]}
          value={value}
          onChange={onChange}
        />
      ) : (
        <label htmlFor={id}>
          {fieldLabels[field]}
          {field === "body" ? (
            <textarea
              id={id}
              value={value}
              rows={6}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : field === "degree" ? (
            <select
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            >
              {["", "고졸", "학사", "석사", "박사"].map((degree) => (
                <option key={degree} value={degree}>
                  {degree || "선택"}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={id}
              value={value}
              disabled={disabled}
              aria-invalid={Boolean(warning)}
              aria-describedby={warning ? `${id}-warning` : undefined}
              placeholder={
                ["start", "end", "date"].includes(field) ? "YYYY.MM" : undefined
              }
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </label>
      )}
      {warning && (
        <p id={`${id}-warning`} className="field-warning">
          {warning}
        </p>
      )}
    </div>
  );
}

export function BasicsFields({
  data,
  change,
}: {
  data: BasicsData;
  change: (data: BasicsData) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const latest = useRef({ data, change });
  latest.current = { data, change };
  const notify = useToastStore((s) => s.show);
  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    try {
      if (!["image/jpeg", "image/png"].includes(file.type))
        throw new Error("JPG 또는 PNG를 선택해 주세요.");
      if (file.size > 2000000)
        throw new Error("사진은 2MB 이하로 선택해 주세요.");
      const result = await resumesApi.uploadPhoto(file);
      if (!result.photoId) throw new Error("사진 응답 계약을 확인해 주세요.");
      latest.current.change({
        ...latest.current.data,
        photoId: result.photoId,
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "사진 업로드 실패");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="field-grid">
      <div className="wide-field photo-control">
        {data.photoId && (
          <img
            src={`/api/photos/${encodeURIComponent(data.photoId)}`}
            alt="등록 사진"
          />
        )}
        <label>
          사진 등록·변경
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={uploading}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {data.photoId && (
          <button
            type="button"
            onClick={() => change({ ...data, photoId: null })}
          >
            사진 삭제
          </button>
        )}
        {uploading && <p role="status">사진 업로드 중…</p>}
      </div>
      {(["name", "jobTitle", "email", "phone"] as const).map((field) => (
        <Field
          key={field}
          id={`field-basics-${field}`}
          field={field}
          value={data[field]}
          onChange={(value) => change({ ...data, [field]: value })}
        />
      ))}
      <div className="wide-field">
        {data.links.map((link, i) => (
          <div key={i} className="link-row">
            <label>
              라벨
              <input
                value={link.label}
                onChange={(e) =>
                  change({
                    ...data,
                    links: data.links.map((v, n) =>
                      n === i ? { ...v, label: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              URL
              <input
                value={link.url}
                onChange={(e) =>
                  change({
                    ...data,
                    links: data.links.map((v, n) =>
                      n === i ? { ...v, url: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                change({ ...data, links: data.links.filter((_, n) => n !== i) })
              }
            >
              링크 삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={data.links.length >= 3}
          onClick={() =>
            change({
              ...data,
              links: [...data.links, { label: "", url: "" }],
            })
          }
        >
          링크 추가
        </button>
      </div>
    </div>
  );
}

export function SummaryFields({
  section,
  change,
}: {
  section: Extract<Section, { type: "summary" }>;
  change: (section: Section) => void;
}) {
  return (
    <div className="field-grid">
      {(["headline", "body"] as const).map((field) => (
        <Field
          key={field}
          id={`field-summary-${field}`}
          field={field}
          value={section.data[field]}
          onChange={(value) =>
            change({ ...section, data: { ...section.data, [field]: value } })
          }
        />
      ))}
      <span>{Array.from(section.data.body).length}자</span>
    </div>
  );
}

export function SkillsFields({
  section,
  change,
}: {
  section: Extract<Section, { type: "skills" }>;
  change: (section: Section) => void;
}) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  function add() {
    if (!draft) return;
    if (section.data.tags.includes(draft)) {
      setMessage("이미 등록한 태그입니다.");
      return;
    }
    if (section.data.tags.length >= 30) {
      setMessage("태그는 최대 30개입니다.");
      return;
    }
    change({ ...section, data: { tags: [...section.data.tags, draft] } });
    setDraft("");
    setMessage("");
  }
  return (
    <div>
      <label>
        기술 태그
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (["Enter", ","].includes(e.key)) {
              e.preventDefault();
              add();
            }
          }}
        />
      </label>
      {message && <p>{message}</p>}
      <div className="tag-list">
        {section.data.tags.map((tag, i) => (
          <button
            key={`${tag}-${i}`}
            type="button"
            onClick={() =>
              change({
                ...section,
                data: { tags: section.data.tags.filter((_, n) => n !== i) },
              })
            }
          >
            {tag} ×
          </button>
        ))}
      </div>
    </div>
  );
}

type ItemSection = Extract<Section, { items: unknown[] }>;
type EditableItem = Record<string, string | boolean>;

export function ItemFields({
  section,
  change,
  openItem,
  setOpenItem,
}: {
  section: ItemSection;
  change: (section: Section) => void;
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const items = section.items as unknown as EditableItem[];
  const replace = (next: EditableItem[]) =>
    change({ ...section, items: next } as unknown as Section);
  const fields = itemFields[section.type];
  return (
    <div>
      {!items.length && <p>등록된 항목이 없습니다.</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          replace(
            arrayMove(
              items,
              items.findIndex((i) => i.id === active.id),
              items.findIndex((i) => i.id === over.id),
            ),
          );
        }}
      >
        <SortableContext items={items.map((item) => String(item.id))}>
          {items.map((item, index) => (
            <Sortable key={String(item.id)} id={String(item.id)} label="항목">
              <div className="entry-card">
                <button
                  type="button"
                  aria-expanded={openItem === item.id}
                  onClick={() =>
                    setOpenItem(openItem === item.id ? null : String(item.id))
                  }
                >
                  {item[fields[0]] || "(제목 없음)"} · {item[fields[1]]}
                  {item.start &&
                    ` · ${item.start} ~ ${item.current ? "현재" : item.end}`}
                  {item.date && ` · ${item.date}`}
                </button>
                {openItem === item.id && (
                  <div className="field-grid">
                    {fields.map((field) =>
                      field === "current" ? (
                        <label key={field}>
                          <input
                            type="checkbox"
                            checked={Boolean(item.current)}
                            onChange={(e) =>
                              replace(
                                items.map((v, n) =>
                                  n === index
                                    ? { ...v, current: e.target.checked }
                                    : v,
                                ),
                              )
                            }
                          />
                          {section.type === "education" ? "재학중" : "재직중"}
                        </label>
                      ) : (
                        <Field
                          key={field}
                          id={`field-${section.type}-${item.id}-${field}`}
                          field={field}
                          value={String(item[field])}
                          disabled={field === "end" && Boolean(item.current)}
                          start={String(item.start ?? "")}
                          onChange={(value) =>
                            replace(
                              items.map((v, n) =>
                                n === index ? { ...v, [field]: value } : v,
                              ),
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                )}
                <div className="entry-actions">
                  <button
                    type="button"
                    disabled={items.length >= 20}
                    onClick={() =>
                      replace([
                        ...items.slice(0, index + 1),
                        { ...structuredClone(item), id: crypto.randomUUID() },
                        ...items.slice(index + 1),
                      ])
                    }
                  >
                    항목 복제
                  </button>
                  <button
                    type="button"
                    onClick={() => replace(items.filter((_, n) => n !== index))}
                  >
                    항목 삭제
                  </button>
                </div>
              </div>
            </Sortable>
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        className="add-entry"
        disabled={items.length >= 20}
        onClick={() => {
          const item = newItem(section.type);
          replace([...items, item]);
          setOpenItem(String(item.id));
        }}
      >
        + 항목 추가
      </button>
    </div>
  );
}

export const ExperienceFields = ItemFields;
export const EducationFields = ItemFields;
export const ProjectsFields = ItemFields;
export const CertificatesFields = ItemFields;
export const LanguagesFields = ItemFields;

export function SectionPanel({
  content,
  change,
  focus,
}: {
  content: Content;
  change: (content: Content) => void;
  focus: MissingField | null;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SectionType | null>(null);
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    if (!focus) return;
    setClosed((previous) => {
      const next = new Set(previous);
      next.delete(focus.section);
      return next;
    });
    setOpenItem(focus.item ?? null);
    requestAnimationFrame(() =>
      document
        .getElementById(
          `field-${focus.section}-${focus.item ? `${focus.item}-` : ""}${focus.field}`,
        )
        ?.focus(),
    );
  }, [focus]);
  function body(section: Section) {
    const update = (next: Section) =>
      change(content.map((s) => (s.type === next.type ? next : s)));
    if (section.type === "basics")
      return (
        <BasicsFields
          data={section.data}
          change={(data) => update({ ...section, data })}
        />
      );
    if (section.type === "summary")
      return <SummaryFields section={section} change={update} />;
    if (section.type === "skills")
      return <SkillsFields section={section} change={update} />;
    return (
      <ItemFields
        section={section}
        change={update}
        openItem={openItem}
        setOpenItem={setOpenItem}
      />
    );
  }
  function card(section: Section) {
    return (
      <section
        className={`section-card ${section.hidden ? "section-hidden" : ""}`}
      >
        <header className="section-row">
          <strong>
            {sectionLabels[section.type]}{" "}
            {"items" in section ? `· ${section.items.length}` : ""}
          </strong>
          {section.type !== "basics" && (
            <>
              <button
                type="button"
                aria-label={`${sectionLabels[section.type]} 숨김 전환`}
                onClick={() =>
                  change(
                    content.map((s) =>
                      s.type === section.type
                        ? ({ ...s, hidden: !s.hidden } as Section)
                        : s,
                    ),
                  )
                }
              >
                {section.hidden ? "표시" : "숨김"}
              </button>
              <button
                type="button"
                aria-label={`${sectionLabels[section.type]} 섹션 삭제`}
                onClick={() => setDeleting(section.type)}
              >
                삭제
              </button>
            </>
          )}
          <button
            type="button"
            aria-expanded={!closed.has(section.type)}
            onClick={() => {
              const next = new Set(closed);
              if (next.has(section.type)) {
                next.delete(section.type);
                if (!section.hidden)
                  document
                    .querySelector(`.a4-page [data-section="${section.type}"]`)
                    ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
              } else next.add(section.type);
              setClosed(next);
            }}
          >
            {closed.has(section.type) ? "펼치기" : "접기"}
          </button>
        </header>
        {!closed.has(section.type) && body(section)}
      </section>
    );
  }
  return (
    <div className="section-list">
      {content
        .filter((s) => s.type === "basics")
        .map((section) => (
          <div key={section.type}>{card(section)}</div>
        ))}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const from = content.findIndex((s) => s.type === active.id);
          const to = content.findIndex((s) => s.type === over.id);
          if (from > 0 && to > 0) change(arrayMove(content, from, to));
        }}
      >
        <SortableContext
          items={content.filter((s) => s.type !== "basics").map((s) => s.type)}
        >
          {content
            .filter((s) => s.type !== "basics")
            .map((section) => (
              <Sortable
                key={section.type}
                id={section.type}
                label={sectionLabels[section.type]}
              >
                {card(section)}
              </Sortable>
            ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={() => setAdding(!adding)}>
        + 섹션 추가
      </button>
      {adding && (
        <div className="section-candidates">
          {Object.keys(sectionLabels)
            .filter((type) => !content.some((s) => s.type === type))
            .map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  change([
                    ...content,
                    newSection(type as Exclude<SectionType, "basics">),
                  ]);
                  setAdding(false);
                }}
              >
                {sectionLabels[type as SectionType]}
              </button>
            ))}
          {content.length === 8 && <p>추가할 섹션이 없습니다.</p>}
        </div>
      )}
      {deleting && (
        <ConfirmModal
          title="섹션 삭제 확인"
          message={`${sectionLabels[deleting]} 섹션과 그 안의 항목을 삭제합니다.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            change(content.filter((s) => s.type !== deleting));
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
