import { afterEach, describe, expect, it, vi } from "vitest";
import type { Resume } from "../../domain/resume/types";
import { resumeSeeds } from "../../../tests/fixtures/resumeSeeds";
import { ResumeSaveQueue } from "./ResumeSaveQueue";
import {
  completeness,
  completenessColor,
  requiredFields,
  warning,
  emptyItem,
} from "./resumeRules";

const resume = () => structuredClone(resumeSeeds[0]) as unknown as Resume;
afterEach(() => vi.useRealTimers());
describe("직렬 저장 queue", () => {
  it("1.5초 후 저장하며 title 및 서버 identity를 자동저장 payload에 섞지 않는다", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const initial = resume();
    const queue = new ResumeSaveQueue(initial, save);
    queue.change({
      template: initial.template,
      style: initial.style,
      content: initial.content,
    });
    expect(queue.store.getState().state).toBe("변경됨");
    await vi.advanceTimersByTimeAsync(1499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).not.toHaveProperty("title");
    expect(queue.store.getState().state).toBe("저장됨");
    queue.dispose();
  });
  it("느린 PUT 중 변경은 단일 후속 snapshot으로 보내고 오래된 성공은 저장됨으로 표시하지 않는다", async () => {
    let finish!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const initial = resume();
    const queue = new ResumeSaveQueue(initial, save);
    queue.change(initial);
    const pending = queue.flush();
    const changed = resume();
    if (changed.content[0].type === "basics")
      changed.content[0].data.name = "최종";
    queue.change(changed);
    queue.change(changed);
    expect(queue.flush()).toBe(pending);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.store.getState().state).toBe("저장 중…");
    finish();
    await pending;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].content[0].data.name).toBe("최종");
    expect(queue.store.getState().state).toBe("저장됨");
    queue.dispose();
  });
  it("실패한 flush는 이동/인쇄를 거절하고 재시도는 최신 payload를 저장한다", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue(undefined);
    const queue = new ResumeSaveQueue(resume(), save);
    queue.change(resume());
    await expect(queue.flush()).rejects.toThrow("failed");
    expect(queue.store.getState().state).toBe("저장 실패·다시 시도");
    await queue.flush();
    expect(queue.store.getState().state).toBe("저장됨");
    expect(save).toHaveBeenCalledTimes(2);
    queue.dispose();
  });
});
describe("프론트 전용 검사", () => {
  it("승인 fixture 완성도 90/90/0을 실제 본문에서 계산한다", () => {
    expect(
      resumeSeeds
        .slice(0, 3)
        .map(
          (seed) =>
            completeness(seed.content as unknown as Resume["content"]).score,
        ),
    ).toEqual([90, 90, 0]);
  });
  it("숨긴 항목은 필수값 및 모든 완성도 기준에서 제외한다", () => {
    const draft = structuredClone(resumeSeeds[2]) as unknown as Resume;
    expect(requiredFields(draft.content).map((field) => field.label)).toEqual([
      "희망 직무",
    ]);
    expect(completeness(draft.content).score).toBe(0);
  });
  it.each([
    [49, "red"],
    [50, "orange"],
    [79, "orange"],
    [80, "green"],
  ] as const)("색 경계 %i", (score, color) => {
    expect(completenessColor(score)).toBe(color);
  });
  it("이메일/날짜/역전 경고만 제공하며 current 입력 초기값과 UUID를 생성한다", () => {
    expect(warning("email", "abc@")).toBeTruthy();
    expect(warning("start", "2020.13")).toBeTruthy();
    expect(warning("end", "2020.01", "2021.01")).toBeTruthy();
    expect(warning("start", "2020.01")).toBeUndefined();
    const first = emptyItem("experience");
    const second = emptyItem("experience");
    expect(first.current).toBe(false);
    expect(first.id).not.toBe(second.id);
    expect(first.end).toBe("");
  });
});
