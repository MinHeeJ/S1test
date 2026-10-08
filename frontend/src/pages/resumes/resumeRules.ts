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
export const itemFields = {
  experience: ["company", "position", "start", "end", "current", "description"],
  education: ["school", "major", "degree", "start", "end", "current"],
  projects: ["name", "role", "start", "end", "description", "url"],
  certificates: ["name", "issuer", "date"],
  languages: ["language", "test", "score"],
} as const;
export const labels: Record<string, string> = {
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
const firstField: Record<string, string> = {
  experience: "company",
  education: "school",
  projects: "name",
  certificates: "name",
  languages: "language",
};
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type MissingField = { path: string; label: string };
/** Visible fields alone contribute to PDF eligibility; no save-time validation is done here. */
export function requiredFields(content: ResumeContent): MissingField[] {
  const missing: MissingField[] = [];
  content.forEach((section, index) => {
    if (section.hidden) return;
    if (section.type === "basics") {
      for (const field of ["name", "jobTitle", "email"] as const) {
        const value = section.data[field] ?? "";
        if (!value.trim() || (field === "email" && !emailPattern.test(value))) {
          missing.push({
            path: `content.${index}.data.${field}`,
            label: labels[field],
          });
        }
      }
    } else if ("items" in section) {
      section.items.forEach((item, row) => {
        const field = firstField[section.type];
        const value = (item as unknown as Record<string, string>)[field] ?? "";
        if (!value.trim())
          missing.push({
            path: `content.${index}.items.${row}.${field}`,
            label: `${sectionLabels[section.type]} ${row + 1} ${labels[field]}`,
          });
      });
    }
  });
  return missing;
}
export function completeness(content: ResumeContent) {
  const visible = content.filter((section) => !section.hidden);
  const rules = [
    {
      label: "필수값을 모두 입력하세요 (+50%)",
      points: 50,
      met: requiredFields(content).length === 0,
    },
    {
      label: "자기소개 본문을 입력하세요 (+10%)",
      points: 10,
      met: visible.some(
        (s) => s.type === "summary" && (s.data.body ?? "").trim().length > 0,
      ),
    },
    {
      label: "경력 또는 프로젝트를 추가하세요 (+20%)",
      points: 20,
      met: visible.some(
        (s) =>
          (s.type === "experience" || s.type === "projects") &&
          s.items.length > 0,
      ),
    },
    {
      label: "기술 태그 3개를 추가하세요 (+10%)",
      points: 10,
      met: visible.some(
        (s) => s.type === "skills" && (s.data.tags ?? []).length >= 3,
      ),
    },
    {
      label: "사진을 등록하세요 (+10%)",
      points: 10,
      met: visible.some((s) => s.type === "basics" && Boolean(s.data.photoId)),
    },
  ];
  return {
    score: rules.reduce((sum, rule) => sum + (rule.met ? rule.points : 0), 0),
    rules,
  };
}
export const completenessColor = (score: number) =>
  score < 50 ? "red" : score < 80 ? "orange" : "green";
export function warning(
  field: string,
  value: string,
  start?: string,
): string | undefined {
  if (field === "email" && value && !emailPattern.test(value))
    return "이메일 형식을 확인해주세요.";
  if (["start", "end", "date"].includes(field) && value) {
    if (!/^\d{4}\.(0[1-9]|1[0-2])$/.test(value))
      return "YYYY.MM 형식으로 입력해주세요.";
    if (
      field === "end" &&
      start &&
      /^\d{4}\.(0[1-9]|1[0-2])$/.test(start) &&
      value < start
    ) {
      return "종료일이 시작일보다 빠릅니다.";
    }
  }
}
export function emptyItem(
  type: keyof typeof itemFields,
): Record<string, string | boolean> {
  return Object.fromEntries([
    ["id", crypto.randomUUID()],
    ...itemFields[type].map((field) => [
      field,
      field === "current" ? false : "",
    ]),
  ]);
}
export function emptySection(
  type: Exclude<SectionType, "basics">,
): ResumeSection {
  if (type === "summary")
    return { type, hidden: false, data: { headline: "", body: "" } };
  if (type === "skills") return { type, hidden: false, data: { tags: [] } };
  return { type, hidden: false, items: [] } as ResumeSection;
}
