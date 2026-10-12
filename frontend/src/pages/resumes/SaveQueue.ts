import { resumeApi } from './resumeApi';
import type { ResumeWrite } from './model';
export type SaveState = '저장됨' | '변경됨' | '저장 중…' | '저장 실패·다시 시도';

/** One in-flight write, revision-aware acknowledgements and explicit flush for navigation/printing. */
export class SaveQueue {
  private revision = 0;
  private saved = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private flight?: Promise<void>;
  private disposed = false;
  state: SaveState = '저장됨';
  constructor(
    readonly id: string,
    public snapshot: ResumeWrite,
    private notify: (state: SaveState) => void,
    private failed: (error: unknown) => void,
  ) {}
  private status(state: SaveState) { this.state = state; this.notify(state); }
  change(snapshot: ResumeWrite) {
    this.snapshot = structuredClone(snapshot);
    this.revision++;
    this.status(this.flight ? '저장 중…' : '변경됨');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 1500);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.flight) { await this.flight; return this.flush(); }
    if (this.saved === this.revision || this.disposed) return;
    const revision = this.revision;
    const snapshot = structuredClone(this.snapshot);
    this.status('저장 중…');
    this.flight = resumeApi.save(this.id, snapshot).then(() => {
      this.saved = revision;
    }).catch(error => {
      this.status('저장 실패·다시 시도'); this.failed(error); throw error;
    });
    try { await this.flight; } finally { this.flight = undefined; }
    if (this.revision !== this.saved) return this.flush();
    this.status('저장됨');
  }
  async rename(title: string) {
    await this.flush();
    const revision = ++this.revision;
    this.snapshot = { ...this.snapshot, title };
    this.status('저장 중…');
    this.flight = resumeApi.rename(this.id, title).then(() => { this.saved = revision; }).catch(error => {
      this.status('저장 실패·다시 시도'); this.failed(error); throw error;
    });
    try { await this.flight; } finally { this.flight = undefined; }
    if (this.saved !== this.revision) await this.flush();
    else this.status('저장됨');
  }
  dispose() { this.disposed = true; clearTimeout(this.timer); }
}
