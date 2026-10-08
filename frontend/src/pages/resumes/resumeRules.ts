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
export const fieldLabels: Record<string, string> = {
  name: "이름",
  jobTitle: "희망 직무",
  email: "이메일",
  phone: "전화번호",
  headline: "한 줄 소개",
  body: "본문",
  company: "회사명",
  position: "직책",
  start: "시작일",
  end: "종료일",
  current: "현재 재직·재학 중",
  description: "설명",
  school: "학교명",
  major: "전공",
  degree: "학위",
  role: "역할",
  url: "URL",
  issuer: "발급기관",
  date: "취득일",
  language: "언어",
  test: "시험",
  score: "점수",
  label: "링크 이름",
};
export const fields: Record<SectionType, string[]> = {
  basics: ["name", "jobTitle", "email", "phone"],
  summary: ["headline", "body"],
  skills: [],
  experience: ["company", "position", "start", "end", "current", "description"],
  education: ["school", "major", "degree", "start", "end", "current"],
  projects: ["name", "role", "start", "end", "description", "url"],
  certificates: ["name", "issuer", "date"],
  languages: ["language", "test", "score"],
};
export interface MissingResumeField {
  label: string;
  target: string;
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function missingResumeFields(
  content: ResumeContent,
): MissingResumeField[] {
  const missing: MissingResumeField[] = [];
  content
    .filter((s) => !s.hidden)
    .forEach((section) => {
      if (section.type === "basics") {
        for (const key of ["name", "jobTitle", "email"] as const) {
          const value = section.data[key] ?? "";
          if (!value.trim() || (key === "email" && !emailPattern.test(value))) {
            missing.push({
              label: `기본정보 · ${fieldLabels[key]}`,
              target: `basics-${key}`,
            });
          }
        }
      } else if ("items" in section) {
        section.items.forEach((item, index) => {
          const key = fields[section.type][0];
          const value = (item as unknown as Record<string, unknown>)[key];
          if (typeof value !== "string" || !value.trim()) {
            missing.push({
              label: `${sectionLabels[section.type]} ${index + 1}번째 · ${
                section.type === "projects"
                  ? "프로젝트명"
                  : section.type === "certificates"
                    ? "자격증명"
                    : fieldLabels[key]
              }`,
              target: `${section.type}-${index}-${key}`,
            });
          }
        });
      }
    });
  return missing;
}
export function resumeCompleteness(content: ResumeContent) {
  const visible = content.filter((s) => !s.hidden);
  const criteria = [
    {
      label: "필수값 모두 충족",
      score: 50,
      met: missingResumeFields(content).length === 0,
    },
    {
      label: "자기소개 본문",
      score: 10,
      met: visible.some(
        (s) => s.type === "summary" && (s.data.body ?? "").trim().length > 0,
      ),
    },
    {
      label: "경력 또는 프로젝트",
      score: 20,
      met: visible.some(
        (s) =>
          (s.type === "experience" || s.type === "projects") &&
          s.items.length > 0,
      ),
    },
    {
      label: "기술 태그 3개",
      score: 10,
      met: visible.some(
        (s) => s.type === "skills" && (s.data.tags ?? []).length >= 3,
      ),
    },
    {
      label: "사진 등록",
      score: 10,
      met: visible.some((s) => s.type === "basics" && !!s.data.photoId),
    },
  ];
  const score = criteria.reduce(
    (sum, criterion) => sum + (criterion.met ? criterion.score : 0),
    0,
  );
  return {
    score,
    criteria,
    color: score < 50 ? "red" : score < 80 ? "orange" : "green",
  };
}
export function resumeWarning(
  key: string,
  value: string,
  values: Record<string, unknown>,
): string {
  if (key === "email" && value && !emailPattern.test(value))
    return "이메일 형식을 확인해 주세요.";
  if (
    ["start", "end", "date"].includes(key) &&
    value &&
    !/^\d{4}\.(0[1-9]|1[0-2])$/.test(value)
  ) {
    return "YYYY.MM 형식으로 입력해 주세요.";
  }
  if (
    key === "end" &&
    !values.current &&
    value &&
    typeof values.start === "string" &&
    /^\d{4}\.(0[1-9]|1[0-2])$/.test(value) &&
    /^\d{4}\.(0[1-9]|1[0-2])$/.test(values.start) &&
    value < values.start
  )
    return "종료일이 시작일보다 빠릅니다.";
  return "";
}
export function emptyResumeSection(type: SectionType): ResumeSection {
  if (type === "basics")
    return {
      type,
      hidden: false,
      data: {
        name: "",
        jobTitle: "",
        email: "",
        phone: "",
        links: [],
        photoId: null,
      },
    };
  if (type === "summary")
    return { type, hidden: false, data: { headline: "", body: "" } };
  if (type === "skills") return { type, hidden: false, data: { tags: [] } };
  return { type, hidden: false, items: [] };
}
export function emptyResumeItem(
  type: SectionType,
): Record<string, string | boolean> {
  const item: Record<string, string | boolean> = { id: crypto.randomUUID() };
  fields[type].forEach((key) => {
    item[key] = key === "current" ? false : "";
  });
  return item;
}
