import type { Resume, ResumeContent, ResumeStyle } from "./types";

type JsonObject = Record<string, unknown>;
const itemFields: Record<string, string[]> = {
  experience: ["id", "company", "position", "start", "end", "description"],
  education: ["id", "school", "major", "degree", "start", "end"],
  projects: ["id", "name", "role", "start", "end", "description", "url"],
  certificates: ["id", "name", "issuer", "date"],
  languages: ["id", "language", "test", "score"],
};
const dataFields: Record<string, string[]> = {
  basics: ["name", "jobTitle", "email", "phone"],
  summary: ["headline", "body"],
  skills: [],
};
function check(condition: unknown): asserts condition {
  if (!condition) throw new TypeError("이력서 JSON 구조가 올바르지 않습니다.");
}
function object(value: unknown): asserts value is JsonObject {
  check(value !== null && typeof value === "object" && !Array.isArray(value));
}
function strings(value: JsonObject, fields: string[]) {
  for (const field of fields) {
    if (field in value) check(typeof value[field] === "string");
  }
}

/** Validates structure only; warning-only email/date and empty strings remain unchanged. */
export function assertContent(value: unknown): asserts value is ResumeContent {
  check(Array.isArray(value) && value.length >= 1 && value.length <= 8);
  const seen = new Set<string>();
  for (const [index, section] of value.entries()) {
    object(section);
    check(
      typeof section.type === "string" && typeof section.hidden === "boolean",
    );
    const type = section.type;
    check(!seen.has(type));
    seen.add(type);
    if (index === 0) check(type === "basics" && section.hidden === false);
    if (Object.hasOwn(dataFields, type)) {
      object(section.data);
      check(!("items" in section));
      strings(section.data, dataFields[type]);
      if (type === "basics") {
        if ("photoId" in section.data) {
          const id = section.data.photoId;
          check(
            id === null ||
              (typeof id === "string" &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  id,
                )),
          );
        }
        if ("links" in section.data) {
          check(
            Array.isArray(section.data.links) && section.data.links.length <= 3,
          );
          for (const link of section.data.links) {
            object(link);
            strings(link, ["label", "url"]);
          }
        }
      }
      if (type === "skills" && "tags" in section.data) {
        check(
          Array.isArray(section.data.tags) && section.data.tags.length <= 30,
        );
        check(section.data.tags.every((tag) => typeof tag === "string"));
      }
    } else {
      check(Object.hasOwn(itemFields, type));
      check(
        !("data" in section) &&
          Array.isArray(section.items) &&
          section.items.length <= 20,
      );
      for (const item of section.items) {
        object(item);
        strings(item, itemFields[type]);
        if (
          (type === "education" || type === "experience") &&
          "current" in item
        ) {
          check(typeof item.current === "boolean");
        }
        if (type === "education" && "degree" in item) {
          check(
            ["고졸", "학사", "석사", "박사", ""].includes(
              item.degree as string,
            ),
          );
        }
      }
    }
  }
}
export function assertStyle(value: unknown): asserts value is ResumeStyle {
  object(value);
  check(typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color));
  check(value.font === "pretendard" || value.font === "noto-serif-kr");
  check(
    value.size === "small" || value.size === "medium" || value.size === "large",
  );
}
export function assertResume(value: unknown): asserts value is Resume {
  object(value);
  check(typeof value.id === "string" && typeof value.title === "string");
  check(value.template === "classic" || value.template === "modern");
  if ("updated_at" in value) check(typeof value.updated_at === "string");
  assertStyle(value.style);
  assertContent(value.content);
}
export function serializeResume(value: Resume): string {
  assertResume(value);
  return JSON.stringify(value);
}
export function deserializeResume(json: string): Resume {
  const value: unknown = JSON.parse(json);
  assertResume(value);
  return value;
}
export function serializeContent(value: ResumeContent): string {
  assertContent(value);
  return JSON.stringify(value);
}
export function deserializeContent(json: string): ResumeContent {
  const value: unknown = JSON.parse(json);
  assertContent(value);
  return value;
}
