import type { Content, Section, SectionType } from "../../shared/contracts";

export const sectionLabels: Record<SectionType, string> = {
  basics: "기본정보",
  summary: "자기소개",
  experience: "경력",
  education: "학력",
  skills: "기술스택",
  projects: "프로젝트",
  certificates: "자격증",
  languages: "어학",
};
export const itemFields = {
  experience: ["company", "position", "start", "end", "current", "description"],
  education: ["school", "major", "degree", "start", "end", "current"],
  projects: ["name", "role", "start", "end", "description", "url"],
  certificates: ["name", "issuer", "date"],
  languages: ["language", "test", "score"],
} as const;
export const fieldLabels: Record<string, string> = {
  name: "이름",
  jobTitle: "희망 직무",
  email: "이메일",
  phone: "전화번호",
  headline: "한 줄 소개",
  body: "본문",
  company: "회사명",
  position: "직책",
  school: "학교명",
  major: "전공",
  degree: "학위",
  start: "시작",
  end: "종료",
  description: "설명",
  role: "역할",
  url: "링크",
  issuer: "발급기관",
  date: "취득일",
  language: "언어",
  test: "시험명",
  score: "점수",
};
export function newSection(type: Exclude<SectionType, "basics">): Section {
  if (type === "summary")
    return { type, hidden: false, data: { headline: "", body: "" } };
  if (type === "skills") return { type, hidden: false, data: { tags: [] } };
  return { type, hidden: false, items: [] } as Section;
}
export function newItem(
  type: keyof typeof itemFields,
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = { id: crypto.randomUUID() };
  for (const field of itemFields[type])
    result[field] = field === "current" ? false : "";
  return result;
}
export const nonblank = (text: string) =>
  text.replace(/[\s\p{White_Space}]/gu, "").length > 0;
export const emailValid = (text: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
export interface MissingField {
  section: SectionType;
  item?: string;
  field: string;
  label: string;
}
export function missingFields(content: Content): MissingField[] {
  const missing: MissingField[] = [];
  for (const section of content.filter((s) => !s.hidden)) {
    if (section.type === "basics") {
      for (const field of ["name", "jobTitle", "email"] as const) {
        if (
          !nonblank(section.data[field]) ||
          (field === "email" && !emailValid(section.data.email))
        ) {
          missing.push({
            section: "basics",
            field,
            label: `기본정보 · ${fieldLabels[field]}`,
          });
        }
      }
    } else if ("items" in section) {
      const first = itemFields[section.type][0];
      section.items.forEach((item, index) => {
        const value = (item as unknown as Record<string, string>)[first];
        if (!nonblank(value))
          missing.push({
            section: section.type,
            item: item.id,
            field: first,
            label: `${sectionLabels[section.type]} ${index + 1} · ${fieldLabels[first]}`,
          });
      });
    }
  }
  return missing;
}
export function completeness(content: Content) {
  const visible = content.filter((s) => !s.hidden);
  const required = missingFields(content).length === 0;
  const summary = visible.some(
    (s) => s.type === "summary" && nonblank(s.data.body),
  );
  const work = visible.some(
    (s) =>
      (s.type === "experience" || s.type === "projects") && s.items.length > 0,
  );
  const skills = visible.some(
    (s) => s.type === "skills" && s.data.tags.length >= 3,
  );
  const photo = visible.some(
    (s) => s.type === "basics" && s.data.photoId !== null,
  );
  const score =
    (required ? 50 : 0) +
    (summary ? 10 : 0) +
    (work ? 20 : 0) +
    (skills ? 10 : 0) +
    (photo ? 10 : 0);
  const criteria = [
    !required && "필수 항목을 입력하세요 (+50%)",
    !summary && "자기소개 본문 (+10%)",
    !work && "경력 또는 프로젝트 (+20%)",
    !skills && "기술 태그 3개 (+10%)",
    !photo && "사진을 등록하세요 (+10%)",
  ].filter((s): s is string => Boolean(s));
  return { score, criteria, color: completionColor(score) };
}
export const completionColor = (score: number) =>
  score < 50 ? "red" : score < 80 ? "orange" : "green";
export function dateWarning(value: string, start?: string): string | null {
  if (!value) return null;
  if (!/^\d{4}\.(0[1-9]|1[0-2])$/.test(value))
    return "YYYY.MM 형식으로 입력해 주세요.";
  if (start && /^\d{4}\.(0[1-9]|1[0-2])$/.test(start) && value < start)
    return "종료일이 시작일보다 빠릅니다.";
  return null;
}
