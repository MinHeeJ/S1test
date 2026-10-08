export type ResumeTemplate = "classic" | "modern";
export type StyleFont = "pretendard" | "noto-serif-kr";
export type StyleSize = "small" | "medium" | "large";
export type EducationDegree = "고졸" | "학사" | "석사" | "박사" | "";
export interface ResumeStyle {
  color: string;
  font: StyleFont;
  size: StyleSize;
}
export interface Link {
  label: string;
  url: string;
}
export interface BasicsData {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  links: Link[];
  photoId: string | null;
}
export interface SummaryData {
  headline: string;
  body: string;
}
export interface SkillsData {
  tags: string[];
}
export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
}
export interface EducationItem {
  id: string;
  school: string;
  major: string;
  degree: EducationDegree;
  start: string;
  end: string;
  current: boolean;
}
export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  start: string;
  end: string;
  description: string;
  url: string;
}
export interface CertificateItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
}
export interface LanguageItem {
  id: string;
  language: string;
  test: string;
  score: string;
}
export type ResumeSection =
  | { type: "basics"; hidden: boolean; data: BasicsData }
  | { type: "summary"; hidden: boolean; data: SummaryData }
  | { type: "skills"; hidden: boolean; data: SkillsData }
  | { type: "experience"; hidden: boolean; items: ExperienceItem[] }
  | { type: "education"; hidden: boolean; items: EducationItem[] }
  | { type: "projects"; hidden: boolean; items: ProjectItem[] }
  | { type: "certificates"; hidden: boolean; items: CertificateItem[] }
  | { type: "languages"; hidden: boolean; items: LanguageItem[] };
export type SectionType = ResumeSection["type"];
export type ResumeContent = ResumeSection[];
export interface Resume {
  id: string;
  title: string;
  template: ResumeTemplate;
  style: ResumeStyle;
  content: ResumeContent;
  updated_at?: string;
}
