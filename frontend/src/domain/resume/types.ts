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
export type ResumeId = string;
export type PhotoId = string;

export interface ResumeStyle {
  color: string;
  font: StyleFont;
  size: StyleSize;
}
export interface Link {
  label?: string;
  url?: string;
}
export interface BasicsData {
  name?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  links?: Link[];
  photoId?: PhotoId | null;
}
export interface SummaryData {
  headline?: string;
  body?: string;
}
export interface SkillsData {
  tags?: string[];
}
export interface ExperienceItem {
  id?: string;
  company?: string;
  position?: string;
  start?: string;
  end?: string;
  current?: boolean;
  description?: string;
}
export interface EducationItem {
  id?: string;
  school?: string;
  major?: string;
  degree?: EducationDegree;
  start?: string;
  end?: string;
  current?: boolean;
}
export interface ProjectItem {
  id?: string;
  name?: string;
  role?: string;
  start?: string;
  end?: string;
  description?: string;
  url?: string;
}
export interface CertificateItem {
  id?: string;
  name?: string;
  issuer?: string;
  date?: string;
}
export interface LanguageItem {
  id?: string;
  language?: string;
  test?: string;
  score?: string;
}
export interface BasicsSection {
  type: "basics";
  hidden: boolean;
  data: BasicsData;
}
export interface SummarySection {
  type: "summary";
  hidden: boolean;
  data: SummaryData;
}
export interface SkillsSection {
  type: "skills";
  hidden: boolean;
  data: SkillsData;
}
export interface ExperienceSection {
  type: "experience";
  hidden: boolean;
  items: ExperienceItem[];
}
export interface EducationSection {
  type: "education";
  hidden: boolean;
  items: EducationItem[];
}
export interface ProjectsSection {
  type: "projects";
  hidden: boolean;
  items: ProjectItem[];
}
export interface CertificatesSection {
  type: "certificates";
  hidden: boolean;
  items: CertificateItem[];
}
export interface LanguagesSection {
  type: "languages";
  hidden: boolean;
  items: LanguageItem[];
}
export type ResumeSection =
  | BasicsSection
  | SummarySection
  | ExperienceSection
  | EducationSection
  | SkillsSection
  | ProjectsSection
  | CertificatesSection
  | LanguagesSection;
export type ResumeContent = ResumeSection[];
export interface Resume {
  id: ResumeId;
  title: string;
  template: ResumeTemplate;
  style: ResumeStyle;
  content: ResumeContent;
  updated_at?: string;
}
export const FONT_SIZE_PT: Record<StyleSize, number> = {
  small: 9,
  medium: 10,
  large: 11,
};
