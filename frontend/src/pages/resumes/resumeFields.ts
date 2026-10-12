import type {
  Resume,
  ResumeSection,
  SectionType,
} from "../../domain/resume/types";

export const sectionNames: Record<SectionType, string> = {
  basics: "기본정보",
  summary: "자기소개",
  experience: "경력",
  education: "학력",
  skills: "기술스택",
  projects: "프로젝트",
  certificates: "자격증",
  languages: "어학",
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
export function newSection(type: SectionType): ResumeSection {
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
export function newItem(type: SectionType): {
  id: string;
  [key: string]: string | boolean;
} {
  return {
    id: crypto.randomUUID(),
    ...Object.fromEntries(
      fields[type].map((key) => [key, key === "current" ? false : ""]),
    ),
  };
}
export interface MissingField {
  label: string;
  section: SectionType;
  item?: number;
  field: string;
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function missingFields(resume: Resume): MissingField[] {
  const missing: MissingField[] = [];
  for (const section of resume.content.filter((s) => !s.hidden)) {
    if (section.type === "basics") {
      for (const field of ["name", "jobTitle", "email"] as const) {
        const value = section.data[field] ?? "";
        if (!value.trim() || (field === "email" && !emailPattern.test(value))) {
          missing.push({
            label: `기본정보 · ${labels[field]}`,
            section: section.type,
            field,
          });
        }
      }
    } else if ("items" in section) {
      const field = fields[section.type][0];
      section.items.forEach((item, index) => {
        const value = (item as Record<string, unknown>)[field];
        if (typeof value !== "string" || !value.trim()) {
          missing.push({
            label: `${sectionNames[section.type]} ${index + 1} · ${labels[field]}`,
            section: section.type,
            item: index,
            field,
          });
        }
      });
    }
  }
  return missing;
}
export function completeness(resume: Resume) {
  const visible = resume.content.filter((s) => !s.hidden);
  const summary = visible.find((s) => s.type === "summary");
  const skills = visible.find((s) => s.type === "skills");
  const basics = visible.find((s) => s.type === "basics");
  const criteria = [
    {
      label: "필수값 모두 충족",
      points: 50,
      met: missingFields(resume).length === 0,
    },
    {
      label: "자기소개 본문 1자 이상",
      points: 10,
      met:
        summary?.type === "summary" &&
        Array.from(summary.data.body ?? "").length > 0,
    },
    {
      label: "경력 또는 프로젝트 항목 1개 이상",
      points: 20,
      met: visible.some(
        (s) =>
          (s.type === "experience" || s.type === "projects") &&
          s.items.length > 0,
      ),
    },
    {
      label: "기술 태그 3개 이상",
      points: 10,
      met: skills?.type === "skills" && (skills.data.tags?.length ?? 0) >= 3,
    },
    {
      label: "사진을 등록하세요",
      points: 10,
      met: basics?.type === "basics" && Boolean(basics.data.photoId),
    },
  ];
  const score = criteria.reduce((sum, c) => sum + (c.met ? c.points : 0), 0);
  return {
    score,
    color: score < 50 ? "red" : score < 80 ? "orange" : "green",
    missing: criteria.filter((c) => !c.met),
  };
}
export function warning(
  field: string,
  value: string,
  values: Record<string, unknown>,
): string | undefined {
  if (field === "email" && value && !emailPattern.test(value))
    return "이메일 형식을 확인해 주세요";
  if (
    ["start", "end", "date"].includes(field) &&
    value &&
    !/^\d{4}\.(0[1-9]|1[0-2])$/.test(value)
  ) {
    return "YYYY.MM 형식을 확인해 주세요";
  }
  if (
    field === "end" &&
    !values.current &&
    value &&
    typeof values.start === "string" &&
    /^\d{4}\.(0[1-9]|1[0-2])$/.test(values.start) &&
    value < values.start
  ) {
    return "종료일이 시작일보다 빠릅니다";
  }
}
