export interface ApiResponse<T> {
  success: true;
  meta: Record<string, unknown>;
  data: T;
}

export interface ApiError {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
}

export interface CurrentUser {
  nickname: string;
}
export type Template = "classic" | "modern";
export type StyleColor =
  | "#1F3A5F"
  | "#2563EB"
  | "#0F766E"
  | "#9F1239"
  | "#C2410C"
  | "#374151";
export interface Style {
  color: StyleColor;
  font: "pretendard" | "noto-serif-kr";
  size: "small" | "medium" | "large";
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
  degree: "고졸" | "학사" | "석사" | "박사" | "";
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
export type Section =
  | { type: "basics"; hidden: false; data: BasicsData }
  | {
      type: "summary";
      hidden: boolean;
      data: { headline: string; body: string };
    }
  | { type: "skills"; hidden: boolean; data: { tags: string[] } }
  | { type: "experience"; hidden: boolean; items: ExperienceItem[] }
  | { type: "education"; hidden: boolean; items: EducationItem[] }
  | { type: "projects"; hidden: boolean; items: ProjectItem[] }
  | { type: "certificates"; hidden: boolean; items: CertificateItem[] }
  | { type: "languages"; hidden: boolean; items: LanguageItem[] };
export type SectionType = Section["type"];
export type Content = Section[];
export interface ResumeWrite {
  title: string;
  template: Template;
  style: Style;
  content: Content;
}
export interface Resume extends ResumeWrite {
  id: string;
  updated_at: string;
}
