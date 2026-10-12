export const sectionTypes = [
  "basics",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certificates",
  "languages",
] as const;
export type SectionType = (typeof sectionTypes)[number];
export type Item = Record<string, string | boolean> & { id: string };
export interface Link {
  label: string;
  url: string;
}
export interface SectionData {
  name?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  links?: Link[];
  photoId?: string | null;
  headline?: string;
  body?: string;
  tags?: string[];
}
export interface Section {
  type: SectionType;
  hidden: boolean;
  data?: SectionData;
  items?: Item[];
}
export interface ResumeStyle {
  color: string;
  font: "pretendard" | "noto-serif-kr";
  size: "small" | "medium" | "large";
}
export interface ResumeWrite {
  title: string;
  template: "classic" | "modern";
  style: ResumeStyle;
  content: Section[];
}
export interface Resume extends ResumeWrite {
  id: string;
  updated_at: string;
}
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
export const itemFields: Partial<Record<SectionType, string[]>> = {
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
  position: "직무",
  start: "시작",
  end: "종료",
  description: "업무 내용·설명",
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
export const colors = [
  "#1F3A5F",
  "#2563EB",
  "#0F766E",
  "#9F1239",
  "#C2410C",
  "#374151",
];
export const pt = { small: 9, medium: 10, large: 11 };
export const hasText = (value: string = "") =>
  value.replace(/[\s\u0085]/gu, "").length > 0;
export const emailValid = (value: string = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
export const codePointCount = (value: string) =>
  [...value.replace(/\r\n?/g, "\n")].length;

export function newItem(type: SectionType): Item {
  const item: Item = { id: crypto.randomUUID() };
  for (const field of itemFields[type] ?? [])
    item[field] = field === "current" ? false : "";
  return item;
}
export function newSection(type: SectionType): Section {
  if (type === "summary")
    return { type, hidden: false, data: { headline: "", body: "" } };
  if (type === "skills") return { type, hidden: false, data: { tags: [] } };
  return { type, hidden: false, items: [] };
}
export function snapshot(resume: ResumeWrite): ResumeWrite {
  return structuredClone({
    title: resume.title,
    template: resume.template,
    style: resume.style,
    content: resume.content,
  });
}
export interface MissingField {
  path: string;
  label: string;
}
export function missingFields(content: Section[]): MissingField[] {
  const missing: MissingField[] = [];
  content.forEach((section) => {
    if (section.hidden) return;
    if (section.type === "basics") {
      for (const key of ["name", "jobTitle", "email"] as const) {
        const value = section.data?.[key] ?? "";
        if (!hasText(value) || (key === "email" && !emailValid(value))) {
          missing.push({
            path: `basics-${key}`,
            label: `기본정보 · ${labels[key]}`,
          });
        }
      }
    }
    const first = itemFields[section.type]?.[0];
    if (first)
      section.items?.forEach((item) => {
        if (!hasText(String(item[first])))
          missing.push({
            path: `${section.type}-${item.id}-${first}`,
            label: `${sectionNames[section.type]} · ${labels[first]}`,
          });
      });
  });
  return missing;
}
export function calculateCompleteness(content: Section[]) {
  const visible = content.filter((section) => !section.hidden);
  const section = (type: SectionType) =>
    visible.find((entry) => entry.type === type);
  const criteria = [
    {
      met: missingFields(content).length === 0,
      points: 50,
      label: "필수 항목을 작성하세요 (+50%)",
    },
    {
      met: hasText(section("summary")?.data?.body),
      points: 10,
      label: "자기소개를 작성하세요 (+10%)",
    },
    {
      met: !!(
        section("experience")?.items?.length ||
        section("projects")?.items?.length
      ),
      points: 20,
      label: "경력 또는 프로젝트를 추가하세요 (+20%)",
    },
    {
      met: (section("skills")?.data?.tags?.length ?? 0) >= 3,
      points: 10,
      label: "기술을 3개 이상 등록하세요 (+10%)",
    },
    {
      met: !!section("basics")?.data?.photoId,
      points: 10,
      label: "사진을 등록하세요 (+10%)",
    },
  ];
  const score = criteria.reduce(
    (sum, criterion) => sum + (criterion.met ? criterion.points : 0),
    0,
  );
  return {
    score,
    color: score < 50 ? "red" : score < 80 ? "orange" : "green",
    unmet: criteria
      .filter((criterion) => !criterion.met)
      .map((criterion) => criterion.label),
  };
}
export function dateWarning(key: string, item: Item): string | null {
  const value = String(item[key] ?? "");
  if (
    ["start", "end", "date"].includes(key) &&
    value &&
    !/^\d{4}\.(0[1-9]|1[0-2])$/.test(value)
  ) {
    return "YYYY.MM 형식으로 입력해 주세요.";
  }
  if (
    key === "end" &&
    !item.current &&
    item.start &&
    value &&
    String(item.start) > value
  ) {
    return "종료일이 시작일보다 빠릅니다.";
  }
  return null;
}
