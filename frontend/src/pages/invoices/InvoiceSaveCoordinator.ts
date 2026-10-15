import type { InvoiceWrite } from "./contracts";

export type SaveState =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";
/** One document lane owns snapshots and flush; newer revisions never become stale saved state. */
export class InvoiceSaveCoordinator {
  private latest: InvoiceWrite;
  private revision = 0;
  private committed = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lane: Promise<void> = Promise.resolve();
  private running: Promise<void> | undefined;
  private disposed = false;
  state: SaveState = "저장됨";

  constructor(
    initial: InvoiceWrite,
    private readonly put: (snapshot: InvoiceWrite) => Promise<void>,
    private readonly notify: (state: SaveState) => void,
  ) {
    this.latest = structuredClone(initial);
  }

  change(snapshot: InvoiceWrite) {
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

  dispose() {
    clearTimeout(this.timer);
    this.disposed = true;
  }
}
