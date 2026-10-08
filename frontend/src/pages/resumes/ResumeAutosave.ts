import type { ResumeInput } from "./resumeApi";
export type ResumeSaveState =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";

/** Single-flight revision queue shared by timer, retry, navigation and PDF synchronization. */
export class ResumeAutosave {
  state: ResumeSaveState = "저장됨";
  private revision = 0;
  private savedRevision = 0;
  private latest?: ResumeInput;
  private timer?: ReturnType<typeof setTimeout>;
  private active?: Promise<void>;
  constructor(
    private save: (input: ResumeInput) => Promise<void>,
    private changed: (state: ResumeSaveState) => void,
    private failed: (error: unknown) => void = () => undefined,
  ) {}
  edit(input: ResumeInput) {
    this.latest = JSON.parse(JSON.stringify(input)) as ResumeInput;
    this.revision++;
    this.set("변경됨");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 1500);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.active) return this.active;
    if (this.revision === this.savedRevision) return Promise.resolve();
    this.active = this.drain().finally(() => {
      this.active = undefined;
    });
    return this.active;
  }
  private async drain() {
    try {
      while (this.savedRevision !== this.revision) {
        const revision = this.revision;
        const snapshot = this.latest!;
        this.set("저장 중…");
        await this.save(snapshot);
        this.savedRevision = revision;
      }
      this.set("저장됨");
    } catch (error) {
      this.set("저장 실패·다시 시도");
      this.failed(error);
      throw error;
    }
  }
  dispose() {
    clearTimeout(this.timer);
  }
  private set(state: ResumeSaveState) {
    this.state = state;
    this.changed(state);
  }
}
