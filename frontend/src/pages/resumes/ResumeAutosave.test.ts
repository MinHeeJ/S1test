import { afterEach, describe, expect, it, vi } from "vitest";
import { ResumeAutosave } from "./ResumeAutosave";
import type { ResumeInput } from "./resumeApi";
import {
  missingResumeFields,
  resumeCompleteness,
  resumeWarning,
} from "./resumeRules";
import type { ResumeContent } from "../../domain/resume/types";

const content: ResumeContent = [
  {
    type: "basics",
    hidden: false,
    data: {
      name: "지우",
      jobTitle: "개발자",
      email: "jiwoo@resume.dev",
      phone: "",
      links: [],
      photoId: null,
    },
  },
];
const input = (value: string) => ({
  template: "classic" as const,
  style: {
    color: "#1F3A5F",
    font: "pretendard" as const,
    size: "medium" as const,
  },
  content,
  title: value,
});
afterEach(() => {
  vi.useRealTimers();
});
describe("serialized autosave", () => {
  it("debounces edits for 1.5 seconds", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = new ResumeAutosave(save, vi.fn());
    queue.edit(input("one"));
    await vi.advanceTimersByTimeAsync(1499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.state).toBe("저장됨");
  });
  it("never overlaps PUT and flush waits for the last revision", async () => {
    const releases: (() => void)[] = [];
    const save = vi.fn(
      (_input: ResumeInput) =>
        new Promise<void>((resolve) => releases.push(resolve)),
    );
    const queue = new ResumeAutosave(save, vi.fn());
    queue.edit(input("first"));
    const flush = queue.flush();
    queue.edit(input("second"));
    queue.edit(input("last"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.flush()).toBe(flush);
    releases[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual(input("last"));
    expect(queue.state).not.toBe("저장됨");
    releases[1]();
    await flush;
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
  it("retains newest snapshot for retry and rejects a failed navigation flush", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const queue = new ResumeAutosave(save, vi.fn());
    queue.edit(input("kept"));
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(queue.state).toBe("저장 실패·다시 시도");
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith(input("kept"));
    expect(queue.state).toBe("저장됨");
    queue.dispose();
  });
});
describe("draft-only validation", () => {
  it("ignores hidden sections and empty item arrays in required checks", () => {
    const copy = structuredClone(content);
    copy.push({
      type: "experience",
      hidden: true,
      items: [
        {
          id: "test",
          company: "",
          position: "",
          start: "bad",
          end: "",
          current: false,
          description: "",
        },
      ],
    });
    copy.push({ type: "education", hidden: false, items: [] });
    expect(missingResumeFields(copy)).toEqual([]);
  });
  it("calculates conditions immediately without storing score", () => {
    const copy = structuredClone(content);
    copy.push({
      type: "summary",
      hidden: false,
      data: { headline: "", body: "자기소개" },
    });
    copy.push({
      type: "projects",
      hidden: false,
      items: [
        {
          id: "test",
          name: "프로젝트",
          role: "",
          start: "",
          end: "",
          description: "",
          url: "",
        },
      ],
    });
    copy.push({
      type: "skills",
      hidden: false,
      data: { tags: ["Java", "React", "SQL"] },
    });
    expect(resumeCompleteness(copy).score).toBe(90);
    expect(
      resumeCompleteness(copy)
        .criteria.filter((c) => !c.met)
        .map((c) => c.label),
    ).toEqual(["사진 등록"]);
    expect(resumeCompleteness(copy).color).toBe("green");
    expect(resumeCompleteness(content).color).toBe("orange");
    const empty = structuredClone(content);
    if (empty[0].type === "basics") empty[0].data.jobTitle = "";
    expect(resumeCompleteness(empty).score).toBe(0);
    expect(resumeCompleteness(empty).color).toBe("red");
  });
  it("reports email, date and reversed dates but skips preserved current end warning", () => {
    expect(resumeWarning("email", "abc@", {})).not.toBe("");
    expect(resumeWarning("start", "wrong", {})).not.toBe("");
    expect(resumeWarning("end", "2020.01", { start: "2021.01" })).not.toBe("");
    expect(
      resumeWarning("end", "2020.01", { start: "2021.01", current: true }),
    ).toBe("");
  });
});
