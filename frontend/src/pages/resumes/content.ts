import type {
  ResumeContent,
  ResumeSection,
  SectionType,
} from "../../domain/resume/types";

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
export const fields: Record<string, string[]> = {
  basics: ["name", "jobTitle", "email", "phone"],
  summary: ["headline", "body"],
  experience: ["company", "position", "start", "end", "current", "description"],
  education: ["school", "major", "degree", "start", "end", "current"],
  projects: ["name", "role", "start", "end", "description", "url"],
  certificates: ["name", "issuer", "date"],
  languages: ["language", "test", "score"],
};
export const fieldLabels: Record<string, string> = {
  name: "이름",
  jobTitle: "희망 직무",
  email: "이메일",
  phone: "전화번호",
  headline: "한 줄 소개",
  body: "본문",
  company: "회사명",
  position: "직책",
  start: "시작",
  end: "종료",
  current: "현재",
  description: "설명",
  school: "학교명",
  major: "전공",
  degree: "학위",
  role: "역할",
  url: "링크",
  issuer: "발급기관",
  date: "취득일",
  language: "언어",
  test: "시험명",
  score: "점수",
};
export const firstFields: Record<string, string> = {
  experience: "company",
  education: "school",
  projects: "name",
  certificates: "name",
  languages: "language",
};
export function newSection(type: SectionType): ResumeSection {
  if (type === "skills") return { type, hidden: false, data: { tags: [] } };
  if (type === "summary")
    return { type, hidden: false, data: { headline: "", body: "" } };
  if (type === "basics") throw new Error("기본정보는 추가할 수 없습니다.");
  return { type, hidden: false, items: [] } as ResumeSection;
}
export function newItem(type: SectionType): Record<string, string | boolean> {
  return Object.fromEntries([
    ["id", crypto.randomUUID()],
    ...fields[type].map((key) => [key, key === "current" ? false : ""]),
  ]);
}
export interface MissingField {
  label: string;
  input: string;
  item?: string;
}
export function requiredFields(content: ResumeContent): MissingField[] {
  const missing: MissingField[] = [];
  for (const section of content.filter((s) => !s.hidden)) {
    if (section.type === "basics") {
      for (const key of ["name", "jobTitle", "email"] as const) {
        const value = section.data[key] ?? "";
        if (
          !value.trim() ||
          (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
        ) {
          missing.push({
            label: `기본정보 · ${fieldLabels[key]}`,
            input: `basics-${key}`,
          });
        }
      }
    } else if ("items" in section) {
      section.items.forEach((item, index) => {
        const key = firstFields[section.type];
        if (
          !String(
            (item as unknown as Record<string, unknown>)[key] ?? "",
          ).trim()
        ) {
          missing.push({
            label: `${sectionLabels[section.type]} ${index + 1}번째 · ${fieldLabels[key]}`,
            input: `${item.id}-${key}`,
            item: item.id,
          });
        }
      });
    }
  }
  return missing;
}
export function completeness(content: ResumeContent) {
  const visible = content.filter((s) => !s.hidden);
  const summary = visible.find((s) => s.type === "summary");
  const skills = visible.find((s) => s.type === "skills");
  const basics = visible.find((s) => s.type === "basics");
  const rules = [
    {
      label: "필수값을 채우세요",
      points: 50,
      fulfilled: requiredFields(content).length === 0,
    },
    {
      label: "자기소개 본문을 작성하세요",
      points: 10,
      fulfilled: summary?.type === "summary" && !!summary.data.body?.trim(),
    },
    {
      label: "경력 또는 프로젝트를 추가하세요",
      points: 20,
      fulfilled: visible.some(
        (s) =>
          (s.type === "experience" || s.type === "projects") &&
          s.items.length > 0,
      ),
    },
    {
      label: "기술 태그 3개를 추가하세요",
      points: 10,
      fulfilled: skills?.type === "skills" && skills.data.tags?.length >= 3,
    },
    {
      label: "사진을 등록하세요",
      points: 10,
      fulfilled: basics?.type === "basics" && !!basics.data.photoId,
    },
  ];
  return {
    score: rules.reduce((sum, r) => sum + (r.fulfilled ? r.points : 0), 0),
    missing: rules.filter((r) => !r.fulfilled),
  };
}
export const scoreColor = (score: number) =>
  score < 50 ? "var(--danger)" : score < 80 ? "var(--warn)" : "var(--accent)";
export function warning(
  key: string,
  value: string,
  row: Record<string, unknown>,
): string | undefined {
  if (key === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "이메일 형식을 확인해 주세요.";
  if (
    ["start", "end", "date"].includes(key) &&
    !(key === "end" && row.current)
  ) {
    if (value && !/^\d{4}\.(0[1-9]|1[0-2])$/.test(value))
      return "YYYY.MM 형식으로 입력해 주세요.";
    if (key === "end" && value && row.start && value < String(row.start))
      return "종료일이 시작일보다 이릅니다.";
  }
}
