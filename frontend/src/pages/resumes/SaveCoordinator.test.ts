import { afterEach, expect, it, vi } from "vitest";
import type { ResumeWrite } from "../../shared/contracts";
import { SaveCoordinator } from "./SaveCoordinator";
import { testResume } from "./testResume";

afterEach(() => vi.useRealTimers());
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
it("debounces at 1.5 seconds and serializes a single latest followup snapshot", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const put = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const states: string[] = [];
  const initial = testResume();
  const queue = new SaveCoordinator(initial, put, vi.fn(), (state) =>
    states.push(state),
  );
  queue.change({ ...initial, title: "첫 변경" });
  await vi.advanceTimersByTimeAsync(1499);
  expect(put).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(put).toHaveBeenCalledTimes(1);
  queue.change({ ...initial, title: "둘째" });
  queue.change({ ...initial, title: "최신" });
  await vi.advanceTimersByTimeAsync(1500);
  expect(put).toHaveBeenCalledTimes(1);
  expect(queue.state).toBe("저장 중…");
  release();
  await queue.flush();
  expect(put).toHaveBeenCalledTimes(2);
  expect(put.mock.calls[1][0].title).toBe("최신");
  expect(states.at(-1)).toBe("저장됨");
  queue.dispose();
});
it("failed save stays dirty and an explicit retry retains exactly the latest data", async () => {
  const put = vi
    .fn()
    .mockRejectedValueOnce(new Error("연결 실패"))
    .mockResolvedValue(undefined);
  const initial = testResume();
  const queue = new SaveCoordinator(initial, put, vi.fn(), vi.fn());
  queue.change({ ...initial, title: "보존" });
  await expect(queue.flush()).rejects.toThrow("연결 실패");
  expect(queue.state).toBe("저장 실패·다시 시도");
  await queue.flush();
  expect(put.mock.calls[1][0].title).toBe("보존");
  expect(queue.state).toBe("저장됨");
  queue.dispose();
});
it("PATCH waits behind PUT and subsequent changes are flushed with committed title", async () => {
  let release!: () => void;
  const events: string[] = [];
  const put = vi
    .fn()
    .mockImplementationOnce(() => {
      events.push("put");
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    })
    .mockImplementation(async () => {
      events.push("followup");
    });
  const patch = vi.fn(async () => {
    events.push("patch");
  });
  const initial = testResume();
  const queue = new SaveCoordinator(initial, put, patch, vi.fn());
  queue.change(initial);
  const flushing = queue.flush();
  await tick();
  const renaming = queue.rename("새 제목");
  expect(patch).not.toHaveBeenCalled();
  release();
  await flushing;
  await renaming;
  expect(events).toEqual(["put", "patch"]);
  queue.change({ ...initial, title: "새 제목", template: "modern" });
  await queue.flush();
  expect(put.mock.calls.at(-1)?.[0].title).toBe("새 제목");
  queue.dispose();
});
it("rename before unsaved PUT preserves body edits and its committed title", async () => {
  const initial = testResume();
  const put = vi.fn<(snapshot: ResumeWrite) => Promise<void>>(
    async () => undefined,
  );
  const patch = vi.fn<(title: string) => Promise<void>>(async () => undefined);
  const queue = new SaveCoordinator(initial, put, patch, vi.fn());
  queue.change({ ...initial, template: "modern" });
  await queue.rename("이름 변경");
  expect(put.mock.calls[0][0]).toMatchObject({
    title: "이름 변경",
    template: "modern",
  });
  expect(queue.state).toBe("저장됨");
  queue.dispose();
});
