import { afterEach, expect, it, vi } from "vitest";
import { SaveCoordinator } from "./SaveCoordinator";
import { testInvoice } from "./testInvoice";
import { invoiceSnapshot } from "./contracts";
afterEach(() => vi.useRealTimers());
it("debounces 1.5 seconds and drains the latest title/paid/stamp revision behind in-flight PUT", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const put = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    )
    .mockResolvedValue(undefined);
  const initial = invoiceSnapshot(testInvoice());
  const queue = new SaveCoordinator(initial, put, vi.fn());
  queue.change({ ...initial, title: "첫 변경" });
  await vi.advanceTimersByTimeAsync(1499);
  expect(put).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  queue.change({
    ...initial,
    title: "최신",
    paid: true,
    content: {
      ...initial.content,
      stampPhotoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
  });
  const flushed = queue.flush();
  expect(put).toHaveBeenCalledTimes(1);
  release();
  await flushed;
  expect(put).toHaveBeenCalledTimes(2);
  expect(put.mock.calls[1][0]).toMatchObject({
    title: "최신",
    paid: true,
    content: { stampPhotoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  });
  expect(queue.state).toBe("저장됨");
  queue.dispose();
});
it("failed flush blocks follow-up and retry preserves input", async () => {
  const initial = invoiceSnapshot(testInvoice());
  const put = vi
    .fn()
    .mockRejectedValueOnce(new Error("실패"))
    .mockResolvedValue(undefined);
  const next = vi.fn();
  const queue = new SaveCoordinator(initial, put, vi.fn());
  queue.change({ ...initial, title: "보존" });
  await expect(queue.flush().then(next)).rejects.toThrow("실패");
  expect(next).not.toHaveBeenCalled();
  expect(queue.state).toBe("저장 실패·다시 시도");
  await queue.flush();
  expect(put.mock.calls[1][0].title).toBe("보존");
  queue.dispose();
});
