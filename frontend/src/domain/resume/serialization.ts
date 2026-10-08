import type { Resume } from "./types";

type JsonObject = Record<string, unknown>;
const strings: Record<string, string[]> = {
  basics: ["name", "jobTitle", "email", "phone"],
  summary: ["headline", "body"],
  skills: [],
  experience: ["id", "company", "position", "start", "end", "description"],
  education: ["id", "school", "major", "degree", "start", "end"],
  projects: ["id", "name", "role", "start", "end", "description", "url"],
  certificates: ["id", "name", "issuer", "date"],
  languages: ["id", "language", "test", "score"],
};

function object(value: unknown): asserts value is JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("잘못된 객체 구조입니다.");
  }
}

function stringFields(value: JsonObject, fields: string[]): void {
  for (const field of fields) {
    if (field in value && typeof value[field] !== "string") {
      throw new Error("잘못된 필드 타입입니다.");
    }
  }
}

/** Preserve JSON values/order; user-required fields and date/email formats never block serialization. */
export function serializeResume(resume: Resume): string {
  return JSON.stringify(resume);
}

export function deserializeResume(json: string): Resume {
  const value: unknown = JSON.parse(json);
  object(value);
  object(value.style);
  if (
    !["classic", "modern"].includes(String(value.template)) ||
    !["pretendard", "noto-serif-kr"].includes(String(value.style.font)) ||
    !["small", "medium", "large"].includes(String(value.style.size)) ||
    typeof value.style.color !== "string"
  ) {
    throw new Error("잘못된 이력서 설정입니다.");
  }
  if (
    !Array.isArray(value.content) ||
    value.content.length < 1 ||
    value.content.length > 8
  ) {
    throw new Error("잘못된 섹션 구조입니다.");
  }
  const seen = new Set<string>();
  for (const [index, section] of value.content.entries()) {
    object(section);
    const type = String(section.type);
    if (
      !Object.hasOwn(strings, type) ||
      seen.has(type) ||
      typeof section.hidden !== "boolean" ||
      (index === 0 && (type !== "basics" || section.hidden))
    ) {
      throw new Error("잘못된 섹션 구조입니다.");
    }
    seen.add(type);
    if (["basics", "summary", "skills"].includes(type)) {
      object(section.data);
      stringFields(section.data, strings[type]);
      if (type === "basics") {
        const links = section.data.links;
        if (links !== undefined) {
          if (!Array.isArray(links) || links.length > 3)
            throw new Error("잘못된 링크 구조입니다.");
          for (const link of links) {
            object(link);
            stringFields(link, ["label", "url"]);
          }
        }
        const photo = section.data.photoId;
        if (
          photo !== undefined &&
          photo !== null &&
          typeof photo !== "string"
        ) {
          throw new Error("잘못된 사진 식별자입니다.");
        }
      }
      if (type === "skills" && section.data.tags !== undefined) {
        const tags = section.data.tags;
        if (
          !Array.isArray(tags) ||
          tags.length > 30 ||
          tags.some((tag) => typeof tag !== "string")
        ) {
          throw new Error("잘못된 태그 구조입니다.");
        }
      }
    } else {
      if (!Array.isArray(section.items) || section.items.length > 20) {
        throw new Error("잘못된 항목 구조입니다.");
      }
      for (const item of section.items) {
        object(item);
        stringFields(item, strings[type]);
        if (
          ["experience", "education"].includes(type) &&
          item.current !== undefined &&
          typeof item.current !== "boolean"
        ) {
          throw new Error("잘못된 current 타입입니다.");
        }
        if (
          type === "education" &&
          item.degree !== undefined &&
          !["고졸", "학사", "석사", "박사", ""].includes(String(item.degree))
        ) {
          throw new Error("잘못된 학위입니다.");
        }
      }
    }
  }
  return value as unknown as Resume;
}
