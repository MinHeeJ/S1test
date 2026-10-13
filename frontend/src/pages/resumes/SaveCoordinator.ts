import type { ResumeWrite } from "../../shared/contracts";

export type SaveState =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";
/** One command lane owns PUT, title PATCH and flush; newer revisions never become stale saved state. */
export class SaveCoordinator {
  private latest: ResumeWrite;
  private revision = 0;
  private committed = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lane: Promise<void> = Promise.resolve();
  private running: Promise<void> | undefined;
  private disposed = false;
  state: SaveState = "저장됨";

  constructor(
    initial: ResumeWrite,
    private readonly put: (snapshot: ResumeWrite) => Promise<void>,
    private readonly patch: (title: string) => Promise<void>,
    private readonly notify: (state: SaveState) => void,
  ) {
    this.latest = structuredClone(initial);
  }

  change(snapshot: ResumeWrite) {
    this.latest = structuredClone(snapshot);
    this.revision++;
    if (!this.running) this.emit("변경됨");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 1500);
  }

  private emit(state: SaveState) {
    this.state = state;
    if (!this.disposed) this.notify(state);
  }

  private enqueue(command: () => Promise<void>) {
    const result = this.lane.then(command);
    this.lane = result.catch(() => undefined);
    return result;
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    const result = this.enqueue(async () => {
      try {
        while (this.committed < this.revision) {
          const revision = this.revision;
          const snapshot = structuredClone(this.latest);
          this.emit("저장 중…");
          await this.put(snapshot);
          this.committed = revision;
        }
        this.emit("저장됨");
      } catch (error) {
        this.emit("저장 실패·다시 시도");
        throw error;
      }
    });
    this.running = result;
    return result.finally(() => {
      if (this.running === result) this.running = undefined;
    });
  }

  rename(title: string): Promise<void> {
    clearTimeout(this.timer);
    this.emit("변경됨");
    return this.enqueue(async () => {
      try {
        this.emit("저장 중…");
        await this.patch(title);
        this.latest = { ...this.latest, title };
        this.emit(this.committed < this.revision ? "변경됨" : "저장됨");
      } catch (error) {
        this.emit("저장 실패·다시 시도");
        throw error;
      }
    }).then(() => this.flush());
  }

  dispose() {
    clearTimeout(this.timer);
    this.disposed = true;
  }
}
