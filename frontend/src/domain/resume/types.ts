export type ResumeTemplate = "classic" | "modern";
export type StyleFont = "pretendard" | "noto-serif-kr";
export type StyleSize = "small" | "medium" | "large";
export type EducationDegree = "고졸" | "학사" | "석사" | "박사" | "";
export type SectionType =
  | "basics"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certificates"
  | "languages";

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
interface DataSection<T extends SectionType, D> {
  type: T;
  hidden: boolean;
  data: D;
}
interface ItemsSection<T extends SectionType, I> {
  type: T;
  hidden: boolean;
  items: I[];
}
export type ResumeSection =
  | DataSection<"basics", BasicsData>
  | DataSection<"summary", SummaryData>
  | DataSection<"skills", SkillsData>
  | ItemsSection<"experience", ExperienceItem>
  | ItemsSection<"education", EducationItem>
  | ItemsSection<"projects", ProjectItem>
  | ItemsSection<"certificates", CertificateItem>
  | ItemsSection<"languages", LanguageItem>;
export type ResumeContent = ResumeSection[];
export interface Resume {
  id: string;
  title: string;
  template: ResumeTemplate;
  style: ResumeStyle;
  content: ResumeContent;
  updated_at?: string;
}
