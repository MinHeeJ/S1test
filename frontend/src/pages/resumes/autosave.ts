import type { Resume } from "../../domain/resume/types";
import { resumeApi } from "./api";

export type SaveState =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";

/** One revision-aware queue serializes PUT, PATCH and all departure barriers. */
export class ResumeSaveQueue {
  private revision = 0;
  private saved = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private disposed = false;
  private pendingTitle?: string;
  state: SaveState = "저장됨";

  constructor(
    private latest: Resume,
    private notify: (state: SaveState) => void,
    private save = resumeApi.save,
    private rename = resumeApi.rename,
    private onError?: (error: unknown) => void,
  ) {}

  change(value: Resume) {
    this.latest = value;
    this.revision++;
    if (this.state !== "저장 중…") this.status("변경됨");
    clearTimeout(this.timer);
    if (this.state !== "저장 중…") {
      this.timer = setTimeout(() => {
        void this.flush().catch(() => undefined);
      }, 1500);
    }
  }

  private status(state: SaveState) {
    this.state = state;
    if (!this.disposed) this.notify(state);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) return this.running.then(() => this.flush());
    if (this.saved === this.revision && this.pendingTitle === undefined)
      return Promise.resolve();
    this.status("저장 중…");
    this.running = (async () => {
      try {
        while (
          this.saved !== this.revision ||
          this.pendingTitle !== undefined
        ) {
          if (this.saved !== this.revision) {
            const sent = this.revision;
            const value = structuredClone(this.latest);
            await this.save(value);
            this.saved = sent;
          }
          if (this.pendingTitle !== undefined) {
            const title = this.pendingTitle;
            await this.rename(this.latest.id, title);
            if (this.pendingTitle === title) this.pendingTitle = undefined;
          }
        }
        this.status("저장됨");
      } catch (error) {
        this.status("저장 실패·다시 시도");
        if (!this.disposed) this.onError?.(error);
        throw error;
      } finally {
        this.running = undefined;
      }
    })();
    return this.running;
  }

  async renameTitle(title: string) {
    this.latest = { ...this.latest, title };
    this.pendingTitle = title;
    await this.flush();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
