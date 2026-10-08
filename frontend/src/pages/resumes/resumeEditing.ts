import type {
  Resume,
  ResumeContent,
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
export const itemFields: Partial<Record<SectionType, string[]>> = {
  experience: ["company", "position", "start", "end", "current", "description"],
  education: ["school", "major", "degree", "start", "end", "current"],
  projects: ["name", "role", "start", "end", "description", "url"],
  certificates: ["name", "issuer", "date"],
  languages: ["language", "test", "score"],
};
export const fieldNames: Record<string, string> = {
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
  current: "현재 재직·재학 중",
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
export interface MissingField {
  label: string;
  path: string;
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}\.(0[1-9]|1[0-2])$/;

export function requiredFields(content: ResumeContent): MissingField[] {
  const missing: MissingField[] = [];
  content.forEach((section, index) => {
    if (section.hidden) return;
    if (section.type === "basics") {
      for (const field of ["name", "jobTitle", "email"] as const) {
        const value = section.data[field] ?? "";
        if (!value.trim() || (field === "email" && !emailPattern.test(value))) {
          missing.push({
            label: `기본정보 · ${fieldNames[field]}`,
            path: `content.${index}.data.${field}`,
          });
        }
      }
    } else if ("items" in section) {
      const field = itemFields[section.type]![0];
      section.items.forEach((item, itemIndex) => {
        const value = (item as unknown as Record<string, string>)[field] ?? "";
        if (!value.trim())
          missing.push({
            label: `${sectionNames[section.type]} ${itemIndex + 1} · ${fieldNames[field]}`,
            path: `content.${index}.items.${itemIndex}.${field}`,
          });
      });
    }
  });
  return missing;
}

export function completeness(content: ResumeContent) {
  const visible = content.filter((section) => !section.hidden);
  const criteria = [
    {
      label: "필수값 모두 충족",
      points: 50,
      met: requiredFields(content).length === 0,
    },
    {
      label: "자기소개 본문",
      points: 10,
      met: visible.some((s) => s.type === "summary" && !!s.data.body?.trim()),
    },
    {
      label: "경력 또는 프로젝트",
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
      met: visible.some(
        (s) => s.type === "skills" && (s.data.tags?.length ?? 0) >= 3,
      ),
    },
    {
      label: "사진 등록",
      points: 10,
      met: visible.some((s) => s.type === "basics" && !!s.data.photoId),
    },
  ];
  return {
    score: criteria.reduce((sum, c) => sum + (c.met ? c.points : 0), 0),
    criteria,
  };
}
export function completenessColor(score: number) {
  return score < 50
    ? "var(--danger)"
    : score < 80
      ? "var(--warn)"
      : "var(--accent)";
}
export function warning(
  field: string,
  value: string,
  data: Record<string, unknown>,
): string | undefined {
  if (field === "email" && value && !emailPattern.test(value))
    return "이메일 형식을 확인해 주세요.";
  if (
    ["start", "end", "date"].includes(field) &&
    value &&
    !datePattern.test(value)
  )
    return "YYYY.MM 형식을 확인해 주세요.";
  if (
    field === "end" &&
    !data.current &&
    datePattern.test(value) &&
    typeof data.start === "string" &&
    datePattern.test(data.start) &&
    value < data.start
  )
    return "종료일이 시작일보다 빠릅니다.";
}
export function emptySection(type: SectionType): ResumeSection {
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
export function emptyItem(type: SectionType): Record<string, string | boolean> {
  return Object.fromEntries([
    ["id", crypto.randomUUID()],
    ...itemFields[type]!.map((f) => [f, f === "current" ? false : ""]),
  ]);
}
export type SaveStatus =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";

/** One queue serves autosave, retry, navigation and PDF; callers wait for the final revision. */
export class ResumeAutosave {
  status: SaveStatus = "저장됨";
  private revision = 0;
  private saved = 0;
  private latest: Resume;
  private pending?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(
    initial: Resume,
    private write: (resume: Resume) => Promise<void>,
    private notify: (status: SaveStatus) => void,
  ) {
    this.latest = initial;
  }
  change(resume: Resume) {
    this.latest = structuredClone(resume);
    this.revision++;
    this.setStatus(this.pending ? "저장 중…" : "변경됨");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 1500);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (this.saved === this.revision) return Promise.resolve();
    this.pending = this.drain().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async drain() {
    this.setStatus("저장 중…");
    try {
      while (this.saved !== this.revision) {
        const revision = this.revision;
        const snapshot = structuredClone(this.latest);
        await this.write(snapshot);
        this.saved = revision;
      }
      this.setStatus("저장됨");
    } catch (error) {
      this.setStatus("저장 실패·다시 시도");
      throw error;
    }
  }
  private setStatus(status: SaveStatus) {
    this.status = status;
    this.notify(status);
  }
  dispose() {
    clearTimeout(this.timer);
  }
}
