export type ResumeTemplate = "classic" | "modern";
export type StyleFont = "pretendard" | "noto-serif-kr";
export type StyleSize = "small" | "medium" | "large";
export type EducationDegree = "고졸" | "학사" | "석사" | "박사" | "";
export type PhotoId = string;
export type ResumeStyle = { color: string; font: StyleFont; size: StyleSize };
export type Link = { label: string; url: string };
export type BasicsData = {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  links: Link[];
  photoId: PhotoId | null;
};
export type SummaryData = { headline: string; body: string };
export type SkillsData = { tags: string[] };
export type ExperienceItem = {
  id: string;
  company: string;
  position: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
};
export type EducationItem = {
  id: string;
  school: string;
  major: string;
  degree: EducationDegree;
  start: string;
  end: string;
  current: boolean;
};
export type ProjectItem = {
  id: string;
  name: string;
  role: string;
  start: string;
  end: string;
  description: string;
  url: string;
};
export type CertificateItem = {
  id: string;
  name: string;
  issuer: string;
  date: string;
};
export type LanguageItem = {
  id: string;
  language: string;
  test: string;
  score: string;
};
type DataSection<T extends string, D> = { type: T; hidden: boolean; data: D };
type ItemSection<T extends string, I> = {
  type: T;
  hidden: boolean;
  items: I[];
};
export type BasicsSection = DataSection<"basics", BasicsData>;
export type SummarySection = DataSection<"summary", SummaryData>;
export type SkillsSection = DataSection<"skills", SkillsData>;
export type ExperienceSection = ItemSection<"experience", ExperienceItem>;
export type EducationSection = ItemSection<"education", EducationItem>;
export type ProjectsSection = ItemSection<"projects", ProjectItem>;
export type CertificatesSection = ItemSection<"certificates", CertificateItem>;
export type LanguagesSection = ItemSection<"languages", LanguageItem>;
export type ResumeSection =
  | BasicsSection
  | SummarySection
  | SkillsSection
  | ExperienceSection
  | EducationSection
  | ProjectsSection
  | CertificatesSection
  | LanguagesSection;
export type SectionType = ResumeSection["type"];
export type ResumeContent = ResumeSection[];
export type Resume = {
  id: string;
  title: string;
  template: ResumeTemplate;
  style: ResumeStyle;
  content: ResumeContent;
  updated_at?: string;
};
