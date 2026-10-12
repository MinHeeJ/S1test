import { snapshot, type ResumeWrite } from "./model";
export type SaveState =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";

/** One queue for PUT, PATCH and flush callers; no stale response can mark a newer draft saved. */
export class SaveCoordinator {
  private draft: ResumeWrite;
  private revision = 0;
  private saved = 0;
  private pendingTitle: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private disposed = false;
  state: SaveState = "저장됨";

  constructor(
    initial: ResumeWrite,
    private readonly put: (value: ResumeWrite) => Promise<void>,
    private readonly patch: (title: string) => Promise<void>,
    private readonly notify: (state: SaveState) => void,
  ) {
    this.draft = snapshot(initial);
  }

  private status(state: SaveState) {
    this.state = state;
    if (!this.disposed) this.notify(state);
  }
  change(value: ResumeWrite) {
    this.draft = snapshot(value);
    this.revision++;
    this.status(this.running ? "저장 중…" : "변경됨");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 1500);
  }
  rename(title: string): Promise<void> {
    this.draft.title = title;
    this.pendingTitle = title;
    this.status(this.running ? "저장 중…" : "변경됨");
    return this.flush();
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.pendingTitle === null && this.revision === this.saved)
      return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    this.status("저장 중…");
    try {
      while (this.pendingTitle !== null || this.revision !== this.saved) {
        if (this.pendingTitle !== null) {
          const title = this.pendingTitle;
          await this.patch(title);
          if (this.pendingTitle === title) this.pendingTitle = null;
        }
        if (this.revision !== this.saved) {
          const version = this.revision;
          await this.put(snapshot(this.draft));
          this.saved = version;
        }
      }
      this.status("저장됨");
    } catch (error) {
      clearTimeout(this.timer);
      this.status("저장 실패·다시 시도");
      throw error;
    }
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
