import { afterEach, describe, expect, it, vi } from "vitest";
import type { Resume } from "../../domain/resume/types";
import { ResumeSaveQueue } from "./autosave";
import { newSection } from "./resumeFields";
const documentValue = (): Resume => ({
  id: "17",
  title: "제목",
  template: "classic",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  content: [newSection("basics")],
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
afterEach(() => vi.useRealTimers());
describe("revision-aware save barriers", () => {
  it("waits 1.5 seconds and sends the latest revision", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue({});
    const queue = new ResumeSaveQueue(documentValue(), vi.fn(), save);
    queue.change({ ...documentValue(), template: "modern" });
    await vi.advanceTimersByTimeAsync(1499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].template).toBe("modern");
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
  it("keeps at most one active PUT and drains edits after its acknowledgement", async () => {
    const first = deferred();
    const second = deferred();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const queue = new ResumeSaveQueue(documentValue(), vi.fn(), save);
    queue.change(documentValue());
    const flush = queue.flush();
    queue.change({ ...documentValue(), template: "modern" });
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.state).toBe("저장 중…");
    expect(save.mock.calls[1][0].template).toBe("modern");
    second.resolve();
    await flush;
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
  it("preserves the latest failed value and requires explicit retry", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("실패"))
      .mockResolvedValue({});
    const queue = new ResumeSaveQueue(documentValue(), vi.fn(), save);
    queue.change({ ...documentValue(), template: "modern" });
    await expect(queue.flush()).rejects.toThrow("실패");
    expect(queue.state).toBe("저장 실패·다시 시도");
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).toHaveBeenCalledTimes(1);
    await queue.flush();
    expect(save.mock.calls[1][0].template).toBe("modern");
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
  it("serializes title PATCH behind PUT and keeps edits during PATCH dirty", async () => {
    const put = deferred();
    const patch = deferred();
    const order: string[] = [];
    const save = vi
      .fn()
      .mockImplementationOnce(() => {
        order.push("put");
        return put.promise;
      })
      .mockImplementation(() => {
        order.push("final-put");
        return Promise.resolve({});
      });
    const rename = vi.fn().mockImplementation(() => {
      order.push("patch");
      return patch.promise;
    });
    const queue = new ResumeSaveQueue(documentValue(), vi.fn(), save, rename);
    queue.change(documentValue());
    const work = queue.flush();
    const title = queue.renameTitle("변경 제목");
    expect(order).toEqual(["put"]);
    put.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["put", "patch"]);
    queue.change({ ...documentValue(), template: "modern" });
    patch.resolve();
    await title;
    await work;
    expect(order).toEqual(["put", "patch", "final-put"]);
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
  it("retries a failed PATCH without inventing a title rollback API", async () => {
    const rename = vi
      .fn()
      .mockRejectedValueOnce(new Error("실패"))
      .mockResolvedValue({});
    const queue = new ResumeSaveQueue(
      documentValue(),
      vi.fn(),
      vi.fn(),
      rename,
    );
    await expect(queue.renameTitle("새 제목")).rejects.toThrow();
    await queue.flush();
    expect(rename).toHaveBeenNthCalledWith(2, "17", "새 제목");
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
});
