import type { Resume, ResumeContent } from "./types";

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
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_STRUCTURE");
}
function strings(value: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    if (field in value && typeof value[field] !== "string")
      throw new Error("INVALID_STRUCTURE");
  }
}
function array(value: unknown, max: number): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("INVALID_STRUCTURE");
}

/** 저장을 막는 필수값/이메일/날짜 검사를 추가하지 않고 JSON 구조만 확인한다. */
export function deserializeContent(json: string): ResumeContent {
  const content: unknown = JSON.parse(json);
  array(content, 8);
  if (!content.length) throw new Error("INVALID_STRUCTURE");
  const seen = new Set<string>();
  content.forEach((section, index) => {
    object(section);
    const type = section.type;
    if (
      typeof type !== "string" ||
      typeof section.hidden !== "boolean" ||
      seen.has(type)
    ) {
      throw new Error("INVALID_STRUCTURE");
    }
    seen.add(type);
    if (index === 0 && (type !== "basics" || section.hidden))
      throw new Error("INVALID_STRUCTURE");
    if (type in dataFields) {
      object(section.data);
      strings(section.data, dataFields[type]);
      if ("items" in section) throw new Error("INVALID_STRUCTURE");
      if (type === "basics") {
        if ("links" in section.data) {
          array(section.data.links, 3);
          section.data.links.forEach((link) => {
            object(link);
            strings(link, ["label", "url"]);
          });
        }
        const photoId = section.data.photoId;
        if (
          photoId !== undefined &&
          photoId !== null &&
          typeof photoId !== "string"
        ) {
          throw new Error("INVALID_STRUCTURE");
        }
      }
      if (type === "skills" && "tags" in section.data) {
        array(section.data.tags, 30);
        if (section.data.tags.some((tag) => typeof tag !== "string"))
          throw new Error("INVALID_STRUCTURE");
      }
    } else if (type in itemFields) {
      if ("data" in section) throw new Error("INVALID_STRUCTURE");
      array(section.items, 20);
      section.items.forEach((item) => {
        object(item);
        strings(item, itemFields[type]);
        if (
          (type === "experience" || type === "education") &&
          "current" in item &&
          typeof item.current !== "boolean"
        )
          throw new Error("INVALID_STRUCTURE");
        if (
          type === "education" &&
          "degree" in item &&
          !["고졸", "학사", "석사", "박사", ""].includes(item.degree as string)
        ) {
          throw new Error("INVALID_STRUCTURE");
        }
      });
    } else throw new Error("INVALID_STRUCTURE");
  });
  return content as ResumeContent;
}

export function serializeContent(content: ResumeContent): string {
  const json = JSON.stringify(content);
  deserializeContent(json);
  return json;
}

export function deserializeResume(json: string): Resume {
  const value: unknown = JSON.parse(json);
  object(value);
  strings(value, ["id", "title", "updated_at"]);
  if (!["classic", "modern"].includes(value.template as string))
    throw new Error("INVALID_STRUCTURE");
  object(value.style);
  if (
    typeof value.style.color !== "string" ||
    !["pretendard", "noto-serif-kr"].includes(value.style.font as string) ||
    !["small", "medium", "large"].includes(value.style.size as string)
  )
    throw new Error("INVALID_STRUCTURE");
  deserializeContent(JSON.stringify(value.content));
  return value as Resume;
}

export function serializeResume(resume: Resume): string {
  const json = JSON.stringify(resume);
  deserializeResume(json);
  return json;
}
