import type { Resume } from "./types";

const fields: Record<string, string[]> = {
  basics: ["name", "jobTitle", "email", "phone"],
  summary: ["headline", "body"],
  skills: [],
  experience: ["id", "company", "position", "start", "end", "description"],
  education: ["id", "school", "major", "degree", "start", "end"],
  projects: ["id", "name", "role", "start", "end", "description", "url"],
  certificates: ["id", "name", "issuer", "date"],
  languages: ["id", "language", "test", "score"],
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("잘못된 이력서 구조입니다.");
  return value as Record<string, unknown>;
}

function strings(value: Record<string, unknown>, names: string[]) {
  for (const key of names) {
    if (typeof value[key] !== "string")
      throw new Error("잘못된 필드 타입입니다.");
  }
}

/** Structural round-trip only: blank values, warning dates and hidden data are never normalized. */
export function deserializeResume(json: string): Resume {
  const value = object(JSON.parse(json));
  strings(value, ["id", "title"]);
  if (!["classic", "modern"].includes(String(value.template)))
    throw new Error("잘못된 템플릿입니다.");
  const style = object(value.style);
  strings(style, ["color", "font", "size"]);
  if (
    !["pretendard", "noto-serif-kr"].includes(String(style.font)) ||
    !["small", "medium", "large"].includes(String(style.size))
  )
    throw new Error("잘못된 스타일입니다.");
  if (
    !Array.isArray(value.content) ||
    value.content.length < 1 ||
    value.content.length > 8
  ) {
    throw new Error("잘못된 섹션 개수입니다.");
  }
  const seen = new Set<string>();
  for (const [index, raw] of value.content.entries()) {
    const section = object(raw);
    const type = String(section.type);
    if (
      !Object.hasOwn(fields, type) ||
      seen.has(type) ||
      typeof section.hidden !== "boolean"
    ) {
      throw new Error("잘못된 섹션 구조입니다.");
    }
    seen.add(type);
    if (index === 0 && (type !== "basics" || section.hidden))
      throw new Error("기본정보는 첫 번째에 표시됩니다.");
    if (["basics", "summary", "skills"].includes(type)) {
      if ("items" in section) throw new Error("잘못된 섹션 구조입니다.");
      const data = object(section.data);
      strings(data, fields[type]);
      if (type === "basics") {
        if (!(data.photoId === null || typeof data.photoId === "string"))
          throw new Error("잘못된 사진 참조입니다.");
        if (!Array.isArray(data.links) || data.links.length > 3)
          throw new Error("링크는 최대 3개입니다.");
        data.links.forEach((link) => strings(object(link), ["label", "url"]));
      }
      if (
        type === "skills" &&
        (!Array.isArray(data.tags) ||
          data.tags.length > 30 ||
          data.tags.some((tag) => typeof tag !== "string"))
      )
        throw new Error("잘못된 기술 태그입니다.");
    } else {
      if (
        "data" in section ||
        !Array.isArray(section.items) ||
        section.items.length > 20
      ) {
        throw new Error("잘못된 항목 구조입니다.");
      }
      const itemIds = new Set<string>();
      for (const rawItem of section.items) {
        const item = object(rawItem);
        strings(item, fields[type]);
        if (itemIds.has(String(item.id))) throw new Error("중복 항목입니다.");
        itemIds.add(String(item.id));
        if (
          ["experience", "education"].includes(type) &&
          typeof item.current !== "boolean"
        ) {
          throw new Error("잘못된 현재 상태입니다.");
        }
        if (
          type === "education" &&
          !["고졸", "학사", "석사", "박사", ""].includes(String(item.degree))
        ) {
          throw new Error("잘못된 학위입니다.");
        }
      }
    }
  }
  return value as unknown as Resume;
}

export function serializeResume(resume: Resume): string {
  const json = JSON.stringify(resume);
  deserializeResume(json);
  return json;
}
