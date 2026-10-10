import { afterEach, expect, it, vi } from "vitest";
import type { Resume } from "../../domain/resume/types";
import { ResumeAutosave } from "./autosave";
import { resumesApi } from "./api";

const resume: Resume = {
  id: "queue-resume",
  title: "원본",
  template: "classic",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  content: [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "처음",
        jobTitle: "",
        email: "",
        phone: "",
        links: [],
        photoId: null,
      },
    },
  ],
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("changes debounce 1.5 seconds and retain a final change made during the first PUT", async () => {
  vi.useFakeTimers();
  let resolveFirst!: () => void;
  let active = 0;
  let maximum = 0;
  const values: unknown[] = [];
  vi.spyOn(resumesApi, "update").mockImplementation(async (_id, value) => {
    active++;
    maximum = Math.max(maximum, active);
    values.push(value);
    if (values.length === 1)
      await new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
    active--;
    return { success: true, meta: {} };
  });
  const queue = new ResumeAutosave(resume, vi.fn());
  queue.change({
    ...resume,
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "첫 입력",
          jobTitle: "",
          email: "",
          phone: "",
          links: [],
          photoId: null,
        },
      },
    ],
  });
  await vi.advanceTimersByTimeAsync(1499);
  expect(values).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(values).toHaveLength(1);
  queue.change({
    ...resume,
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "최종 입력",
          jobTitle: "",
          email: "",
          phone: "",
          links: [],
          photoId: null,
        },
      },
    ],
  });
  resolveFirst();
  await queue.flush();
  expect(maximum).toBe(1);
  expect(values).toHaveLength(2);
  expect(values[1]).toMatchObject({
    content: [{ data: { name: "최종 입력" } }],
  });
  expect(queue.status).toBe("저장됨");
  queue.dispose();
});
it("PATCH and PUT use the same serial boundary and PUT never echoes an obsolete title", async () => {
  const order: string[] = [];
  vi.spyOn(resumesApi, "update").mockImplementation(async (_id, value) => {
    order.push("PUT");
    expect(value).not.toHaveProperty("title");
    return { success: true, meta: {} };
  });
  vi.spyOn(resumesApi, "rename").mockImplementation(async () => {
    order.push("PATCH");
    return { success: true, meta: {} };
  });
  const queue = new ResumeAutosave(resume, vi.fn());
  queue.change({ ...resume, template: "modern" });
  await Promise.all([queue.flush(), queue.rename("새 제목")]);
  expect(order).toEqual(["PUT", "PATCH"]);
  expect(queue.current.title).toBe("새 제목");
  queue.dispose();
});
it("flush retries a failed title PATCH instead of falsely reporting saved", async () => {
  const patch = vi
    .spyOn(resumesApi, "rename")
    .mockRejectedValueOnce(new Error("제목 실패"))
    .mockResolvedValueOnce({ success: true, meta: {} });
  const queue = new ResumeAutosave(resume, vi.fn());
  await expect(queue.rename("재시도 제목")).rejects.toThrow("제목 실패");
  await queue.flush();
  expect(patch).toHaveBeenCalledTimes(2);
  expect(queue.current.title).toBe("재시도 제목");
  expect(queue.status).toBe("저장됨");
  queue.dispose();
});
it("save rejection keeps changed snapshot for an explicit retry", async () => {
  vi.spyOn(resumesApi, "update")
    .mockRejectedValueOnce(new Error("실패"))
    .mockResolvedValueOnce({ success: true, meta: {} });
  const queue = new ResumeAutosave(resume, vi.fn());
  queue.change({ ...resume, template: "modern" });
  await expect(queue.flush()).rejects.toThrow("실패");
  expect(queue.status).toBe("저장 실패·다시 시도");
  expect(queue.current.template).toBe("modern");
  await queue.flush();
  expect(queue.status).toBe("저장됨");
  queue.dispose();
});
