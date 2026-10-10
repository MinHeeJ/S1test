import type { Resume } from "../../domain/resume/types";
import { resumesApi } from "./api";

export type SaveStatus =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";

/** One mutation boundary serializes both autosave PUT and explicit title PATCH. */
export class ResumeAutosave {
  private version = 0;
  private saved = 0;
  private pendingTitle?: string;
  private timer?: ReturnType<typeof setTimeout>;
  private tail: Promise<unknown> = Promise.resolve();
  status: SaveStatus = "저장됨";

  constructor(
    public current: Resume,
    private notify: (status: SaveStatus, error?: unknown) => void,
  ) {}

  private report(status: SaveStatus, error?: unknown) {
    this.status = status;
    this.notify(status, error);
  }

  change(resume: Resume) {
    this.current = resume;
    this.version++;
    this.report(this.status === "저장 중…" ? "저장 중…" : "변경됨");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 1500);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.catch(() => undefined).then(operation);
    this.tail = next;
    return next;
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    return this.enqueue(async () => {
      if (this.pendingTitle !== undefined)
        await this.saveTitle(this.pendingTitle);
      while (this.saved !== this.version) {
        const version = this.version;
        const { template, style, content } = this.current;
        this.report("저장 중…");
        try {
          await resumesApi.update(this.current.id, {
            template,
            style,
            content,
          });
          this.saved = version;
        } catch (error) {
          this.report("저장 실패·다시 시도", error);
          throw error;
        }
      }
      this.report("저장됨");
    });
  }

  rename(title: string): Promise<void> {
    return this.enqueue(() => this.saveTitle(title));
  }

  private async saveTitle(title: string): Promise<void> {
    this.pendingTitle = title;
    this.report("저장 중…");
    try {
      await resumesApi.rename(this.current.id, title);
      this.current = { ...this.current, title: title.trim() };
      this.pendingTitle = undefined;
      this.report(this.saved === this.version ? "저장됨" : "변경됨");
    } catch (error) {
      this.report("저장 실패·다시 시도", error);
      throw error;
    }
  }

  dispose() {
    clearTimeout(this.timer);
  }
}
