import { createStore } from "zustand/vanilla";
import type { ResumeUpdate } from "./resumesApi";
export type SaveState =
  | "저장됨"
  | "변경됨"
  | "저장 중…"
  | "저장 실패·다시 시도";

/** One queue per loaded resume; revision snapshots prevent stale success from marking new changes saved. */
export class ResumeSaveQueue {
  readonly store = createStore<{ state: SaveState }>(() => ({
    state: "저장됨",
  }));
  private revision = 0;
  private saved = 0;
  private latest: ResumeUpdate;
  private pending?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(
    initial: ResumeUpdate,
    private save: (body: ResumeUpdate) => Promise<unknown>,
  ) {
    this.latest = initial;
  }
  change(body: ResumeUpdate) {
    this.latest = structuredClone(body);
    this.revision++;
    if (!this.pending) this.store.setState({ state: "변경됨" });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 1500);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (this.saved === this.revision || this.disposed) return Promise.resolve();
    this.pending = this.drain().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async drain() {
    try {
      while (this.saved !== this.revision && !this.disposed) {
        const revision = this.revision;
        const snapshot = structuredClone(this.latest);
        this.store.setState({ state: "저장 중…" });
        await this.save(snapshot);
        this.saved = revision;
      }
      if (!this.disposed) this.store.setState({ state: "저장됨" });
    } catch (error) {
      if (!this.disposed) this.store.setState({ state: "저장 실패·다시 시도" });
      throw error;
    }
  }
  /** React StrictMode replays setup/cleanup without discarding the loaded editor. */
  activate() {
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
