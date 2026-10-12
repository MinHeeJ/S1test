import type { KeyboardEvent } from "react";
import { fields, labels, warning } from "./resumeFields";
import type { SectionType } from "../../domain/resume/types";

export function ResumeInputs({
  type,
  values,
  prefix,
  update,
}: {
  type: SectionType;
  values: Record<string, unknown>;
  prefix: string;
  update: (field: string, value: string | boolean) => void;
}) {
  const bullet = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || !["experience", "projects"].includes(type))
      return;
    event.preventDefault();
    const target = event.currentTarget;
    const pos = target.selectionStart;
    const value = `${target.value.slice(0, pos)}\n- ${target.value.slice(target.selectionEnd)}`;
    update("description", value);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = pos + 3;
    });
  };
  return (
    <div className="resume-inputs">
      {fields[type].map((field) => {
        const id = `${prefix}-${field}`;
        const value =
          typeof values[field] === "string" ? String(values[field]) : "";
        const required =
          type === "basics"
            ? ["name", "jobTitle", "email"].includes(field)
            : !["summary", "skills"].includes(type) &&
              field === fields[type][0];
        const disabled = field === "end" && Boolean(values.current);
        const caution = disabled ? undefined : warning(field, value, values);
        const name =
          field === "name" && type === "projects"
            ? "프로젝트명"
            : field === "name" && type === "certificates"
              ? "자격증명"
              : field === "current"
                ? type === "education"
                  ? "재학중"
                  : "재직중"
                : labels[field];
        return (
          <div
            key={field}
            className={`field ${["body", "description"].includes(field) ? "field-wide" : ""}`}
          >
            <label htmlFor={id} data-required={required}>
              {name}
            </label>
            {field === "current" ? (
              <input
                id={id}
                type="checkbox"
                checked={Boolean(values.current)}
                onChange={(event) => update(field, event.target.checked)}
              />
            ) : field === "degree" ? (
              <select
                id={id}
                value={value}
                onChange={(event) => update(field, event.target.value)}
              >
                {["", "고졸", "학사", "석사", "박사"].map((degree) => (
                  <option key={degree} value={degree}>
                    {degree || "선택 안 함"}
                  </option>
                ))}
              </select>
            ) : ["body", "description"].includes(field) ? (
              <>
                <textarea
                  id={id}
                  value={value}
                  rows={6}
                  onChange={(event) => update(field, event.target.value)}
                  onKeyDown={bullet}
                />
                {field === "body" && (
                  <span className="meta">{Array.from(value).length}자</span>
                )}
              </>
            ) : (
              <input
                id={id}
                value={value}
                disabled={disabled}
                aria-required={required}
                aria-invalid={Boolean(caution)}
                aria-describedby={caution ? `${id}-warning` : undefined}
                onChange={(event) => update(field, event.target.value)}
              />
            )}
            {caution && (
              <p className="field-warning" id={`${id}-warning`}>
                {caution}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
