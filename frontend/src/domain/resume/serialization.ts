import type {
  Resume,
  ResumeContent,
  ResumeStyle,
  ResumeTemplate,
} from "./types";

const itemFields: Record<string, string[]> = {
  experience: ["id", "company", "position", "start", "end", "description"],
  education: ["id", "school", "major", "degree", "start", "end"],
  projects: ["id", "name", "role", "start", "end", "description", "url"],
  certificates: ["id", "name", "issuer", "date"],
  languages: ["id", "language", "test", "score"],
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("객체 형식이 아닙니다.");
  return value as Record<string, unknown>;
}
function strings(data: Record<string, unknown>, fields: string[]) {
  for (const field of fields)
    if (typeof data[field] !== "string")
      throw new Error(`${field}: 문자열 필요`);
}
function allowed(value: unknown, values: readonly string[]) {
  if (typeof value !== "string" || !values.includes(value))
    throw new Error("허용되지 않은 값입니다.");
}
/** Structural checks only: required-field completion and date/email warnings never block serialization. */
export function parseContent(value: unknown): ResumeContent {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8)
    throw new Error("섹션 수 오류");
  const seen = new Set<string>();
  value.forEach((section, index) => {
    const s = object(section);
    allowed(s.type, [
      "basics",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certificates",
      "languages",
    ]);
    const type = s.type as string;
    if (seen.has(type) || typeof s.hidden !== "boolean")
      throw new Error("섹션 구조 오류");
    seen.add(type);
    if (index === 0 && (type !== "basics" || s.hidden))
      throw new Error("기본정보는 첫 번째 비숨김 섹션");
    if (type === "basics" || type === "summary" || type === "skills") {
      if ("items" in s) throw new Error("data 섹션에 items 사용 불가");
      const data = object(s.data);
      if (type === "basics") {
        strings(data, ["name", "jobTitle", "email", "phone"]);
        if (data.photoId !== null && typeof data.photoId !== "string")
          throw new Error("photoId 형식 오류");
        if (!Array.isArray(data.links) || data.links.length > 3)
          throw new Error("링크 수 오류");
        data.links.forEach((link) => strings(object(link), ["label", "url"]));
      } else if (type === "summary") {
        strings(data, ["headline", "body"]);
      } else if (
        !Array.isArray(data.tags) ||
        data.tags.length > 30 ||
        data.tags.some((tag) => typeof tag !== "string")
      )
        throw new Error("태그 구조 오류");
    } else {
      if ("data" in s || !Array.isArray(s.items) || s.items.length > 20)
        throw new Error("항목 구조 오류");
      s.items.forEach((raw) => {
        const item = object(raw);
        strings(item, itemFields[type]);
        if (type === "experience" || type === "education") {
          if (typeof item.current !== "boolean")
            throw new Error("current 불리언 필요");
        }
        if (type === "education")
          allowed(item.degree, ["고졸", "학사", "석사", "박사", ""]);
      });
    }
  });
  return structuredClone(value) as ResumeContent;
}
export function parseStyle(value: unknown): ResumeStyle {
  const style = object(value);
  strings(style, ["color"]);
  allowed(style.font, ["pretendard", "noto-serif-kr"]);
  allowed(style.size, ["small", "medium", "large"]);
  return structuredClone(style) as unknown as ResumeStyle;
}
export function parseResume(value: unknown): Resume {
  const resume = object(value);
  strings(resume, ["id", "title"]);
  allowed(resume.template, ["classic", "modern"]);
  return {
    id: resume.id as string,
    title: resume.title as string,
    template: resume.template as ResumeTemplate,
    style: parseStyle(resume.style),
    content: parseContent(resume.content),
    ...(typeof resume.updated_at === "string"
      ? { updated_at: resume.updated_at }
      : {}),
  };
}
export function deserializeResume(json: string): Resume {
  return parseResume(JSON.parse(json));
}
export function serializeResume(resume: Resume): string {
  return JSON.stringify(parseResume(resume));
}
