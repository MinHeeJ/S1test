import { useRef, useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ResumeSection } from "../../domain/resume/types";
import { ApiRequestError } from "../../shared/http";
import { PhotoPicker } from "../photos/PhotoPicker";
import {
  emptyResumeItem,
  fieldLabels,
  fields,
  resumeWarning,
  sectionLabels,
} from "./resumeRules";

type Row = Record<string, unknown>;
function ResumeFields({
  values,
  keys,
  prefix,
  update,
}: {
  values: Row;
  keys: string[];
  prefix: string;
  update: (key: string, value: unknown) => void;
}) {
  return (
    <div className="resume-fields">
      {keys.map((key) => {
        const value =
          typeof values[key] === "string" ? (values[key] as string) : "";
        const warning = resumeWarning(key, value, values);
        const id = `${prefix}-${key}`;
        return (
          <label
            key={key}
            htmlFor={id}
            className={["body", "description"].includes(key) ? "wide" : ""}
          >
            {fieldLabels[key]}
            {key === "current" ? (
              <input
                id={id}
                aria-label={fieldLabels[key]}
                type="checkbox"
                checked={values.current === true}
                onChange={(event) => update(key, event.target.checked)}
              />
            ) : key === "degree" ? (
              <select
                id={id}
                aria-label={fieldLabels[key]}
                value={value}
                onChange={(event) => update(key, event.target.value)}
              >
                {["", "고졸", "학사", "석사", "박사"].map((degree) => (
                  <option key={degree} value={degree}>
                    {degree || "선택"}
                  </option>
                ))}
              </select>
            ) : ["body", "description"].includes(key) ? (
              <textarea
                id={id}
                aria-label={fieldLabels[key]}
                value={value}
                onChange={(event) => update(key, event.target.value)}
                onKeyDown={(event) => {
                  if (key === "description" && event.key === "Enter") {
                    event.preventDefault();
                    const element = event.currentTarget;
                    const position = element.selectionStart;
                    update(
                      key,
                      value.slice(0, position) +
                        "\n- " +
                        value.slice(element.selectionEnd),
                    );
                    requestAnimationFrame(() => {
                      element.selectionStart = element.selectionEnd =
                        position + 3;
                    });
                  }
                }}
              />
            ) : (
              <input
                id={id}
                aria-label={fieldLabels[key]}
                value={value}
                disabled={key === "end" && values.current === true}
                onChange={(event) => update(key, event.target.value)}
              />
            )}
            {warning && <span className="resume-warning">{warning}</span>}
            {key === "body" && <small>{value.length}자</small>}
          </label>
        );
      })}
    </div>
  );
}
function ResumeItemForm({
  section,
  item,
  index,
  expanded,
  setExpanded,
  update,
  remove,
  duplicate,
  canAdd,
}: {
  section: ResumeSection;
  item: Row;
  index: number;
  expanded: boolean;
  setExpanded: () => void;
  update: (key: string, value: unknown) => void;
  remove: () => void;
  duplicate: () => void;
  canAdd: boolean;
}) {
  const sortable = useSortable({
    id: `${section.type}:${String(item.id ?? index)}`,
  });
  const first = fields[section.type][0];
  return (
    <div
      ref={sortable.setNodeRef}
      className="resume-item"
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
      <div className="resume-item-actions">
        <button
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label="항목 순서 변경"
        >
          ⠿
        </button>
        <button aria-expanded={expanded} onClick={setExpanded}>
          {String(item[first] || "(제목 없음)")}
          <span className="item-summary" aria-hidden="true">
            {[
              item.position || item.role || item.major,
              item.start,
              item.current ? "현재" : item.end,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
        <button disabled={!canAdd} onClick={duplicate}>
          항목 복제
        </button>
        <button onClick={remove}>항목 삭제</button>
      </div>
      {expanded && (
        <ResumeFields
          values={item}
          keys={fields[section.type]}
          prefix={`${section.type}-${index}`}
          update={update}
        />
      )}
    </div>
  );
}
export function ResumeSectionForm({
  section,
  change,
  focus,
  failure,
  expandedItem,
  expandItem,
}: {
  section: ResumeSection;
  change: (section: ResumeSection) => void;
  focus: string;
  failure: (error: unknown) => void;
  expandedItem: string | null;
  expandItem: (id: string | null) => void;
}) {
  const [tag, setTag] = useState("");
  const latest = useRef({ section, change, failure });
  latest.current = { section, change, failure };
  const unauthorized = useRef(() =>
    latest.current.failure(
      new ApiRequestError(401, {
        success: false,
        meta: {},
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
        field: null,
      }),
    ),
  ).current;
  const replaceData = (data: Row) =>
    change({ ...section, data } as unknown as ResumeSection);
  if ("data" in section) {
    const data = section.data as unknown as Row;
    if (section.type === "skills") {
      const tags = section.data.tags ?? [];
      function addTag() {
        const additions = tag
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        replaceData({
          ...data,
          tags: [...new Set([...tags, ...additions])].slice(0, 30),
        });
        setTag("");
      }
      return (
        <div className="resume-tags">
          {tags.map((value) => (
            <button
              key={value}
              onClick={() =>
                replaceData({ ...data, tags: tags.filter((t) => t !== value) })
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
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag();
                }
              }}
            />
          </label>
          <button disabled={tags.length >= 30} onClick={addTag}>
            태그 추가
          </button>
        </div>
      );
    }
    return (
      <>
        <ResumeFields
          values={data}
          keys={fields[section.type]}
          prefix={section.type}
          update={(key, value) => replaceData({ ...data, [key]: value })}
        />
        {section.type === "basics" && (
          <>
            {(section.data.links ?? []).map((link, index) => (
              <div key={index}>
                <ResumeFields
                  values={link as unknown as Row}
                  keys={["label", "url"]}
                  prefix={`link-${index}`}
                  update={(key, value) =>
                    replaceData({
                      ...data,
                      links: (section.data.links ?? []).map((row, n) =>
                        n === index ? { ...row, [key]: value } : row,
                      ),
                    })
                  }
                />
                <button
                  onClick={() =>
                    replaceData({
                      ...data,
                      links: (section.data.links ?? []).filter(
                        (_, n) => n !== index,
                      ),
                    })
                  }
                >
                  링크 삭제
                </button>
              </div>
            ))}
            <button
              disabled={(section.data.links ?? []).length >= 3}
              onClick={() =>
                replaceData({
                  ...data,
                  links: [
                    ...(section.data.links ?? []),
                    { label: "", url: "" },
                  ],
                })
              }
            >
              링크 추가
            </button>
            <PhotoPicker
              photoId={section.data.photoId ?? null}
              onUnauthorized={unauthorized}
              onPhotoChange={(photoId) => {
                const current = latest.current;
                if (current.section.type === "basics") {
                  current.change({
                    ...current.section,
                    data: { ...current.section.data, photoId },
                  });
                }
              }}
            />
          </>
        )}
      </>
    );
  }
  const items = section.items as unknown as Row[];
  const changeItems = (rows: Row[]) =>
    change({ ...section, items: rows } as unknown as ResumeSection);
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const ids = items.map(
          (item, index) => `${section.type}:${String(item.id ?? index)}`,
        );
        changeItems(
          arrayMove(
            items,
            ids.indexOf(String(active.id)),
            ids.indexOf(String(over.id)),
          ),
        );
      }}
    >
      <SortableContext
        items={items.map(
          (item, index) => `${section.type}:${String(item.id ?? index)}`,
        )}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, index) => (
          <ResumeItemForm
            key={String(item.id ?? index)}
            section={section}
            item={item}
            index={index}
            expanded={
              expandedItem === `${section.type}:${String(item.id ?? index)}`
            }
            setExpanded={() => {
              const key = `${section.type}:${String(item.id ?? index)}`;
              expandItem(expandedItem === key ? null : key);
              document
                .querySelector(
                  `.resume-renderer [data-section="${section.type}"]`,
                )
                ?.scrollIntoView?.({ block: "nearest" });
            }}
            update={(key, value) =>
              changeItems(
                items.map((row, n) =>
                  n === index ? { ...row, [key]: value } : row,
                ),
              )
            }
            remove={() => changeItems(items.filter((_, n) => n !== index))}
            duplicate={() =>
              changeItems([...items, { ...item, id: crypto.randomUUID() }])
            }
            canAdd={items.length < 20}
          />
        ))}
      </SortableContext>
      <button
        disabled={items.length >= 20}
        onClick={() => {
          const item = emptyResumeItem(section.type);
          changeItems([...items, item]);
          expandItem(`${section.type}:${item.id}`);
        }}
      >
        + 항목 추가 ({items.length}/20)
      </button>
    </DndContext>
  );
}
