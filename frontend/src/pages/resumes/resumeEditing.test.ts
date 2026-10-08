import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ResumeAutosave,
  completeness,
  completenessColor,
  requiredFields,
  warning,
} from "./resumeEditing";
import { resumeFixture } from "../../../tests/fixtures/resumeSeeds";

afterEach(() => vi.useRealTimers());
describe("자동저장 직렬 큐", () => {
  it("1.5초 지연 후 저장하고 진행 중 변경은 최종 후속 요청 하나로 저장한다", async () => {
    vi.useFakeTimers();
    const resume = resumeFixture();
    const releases: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    const payloads: string[] = [];
    const write = vi.fn((snapshot: typeof resume) => {
      active++;
      maximum = Math.max(maximum, active);
      payloads.push(snapshot.title);
      return new Promise<void>((resolve) =>
        releases.push(() => {
          active--;
          resolve();
        }),
      );
    });
    const queue = new ResumeAutosave(resume, write, () => undefined);
    queue.change({ ...resume, title: "첫 변경" });
    await vi.advanceTimersByTimeAsync(1499);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(queue.status).toBe("저장 중…");
    queue.change({ ...resume, title: "중간" });
    queue.change({ ...resume, title: "마지막" });
    const navigation = queue.flush();
    releases.shift()!();
    await Promise.resolve();
    await Promise.resolve();
    releases.shift()!();
    await navigation;
    expect(maximum).toBe(1);
    expect(payloads).toEqual(["첫 변경", "마지막"]);
    expect(queue.status).toBe("저장됨");
    queue.dispose();
  });
  it("실패 상태에서는 이동을 거부하며 재시도는 마지막 내용으로 성공한다", async () => {
    const resume = resumeFixture();
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("저장 실패"))
      .mockResolvedValue(undefined);
    const queue = new ResumeAutosave(resume, write, () => undefined);
    queue.change(resume);
    await expect(queue.flush()).rejects.toThrow("저장 실패");
    expect(queue.status).toBe("저장 실패·다시 시도");
    await queue.flush();
    expect(queue.status).toBe("저장됨");
    queue.dispose();
  });
});
describe("필수값과 경고는 저장을 차단하지 않는다", () => {
  it("빈 항목 섹션은 충족, 숨긴 항목은 필수 검사에서 제외한다", () => {
    const resume = resumeFixture();
    const basics = resume.content.find((s) => s.type === "basics")!;
    basics.data.jobTitle = "";
    const experience = resume.content.find((s) => s.type === "experience")!;
    experience.items[0].company = "";
    experience.hidden = true;
    expect(requiredFields(resume.content).map((f) => f.label)).toContain(
      "기본정보 · 희망 직무",
    );
    expect(
      requiredFields(resume.content).some((f) => f.label.includes("회사명")),
    ).toBe(false);
    expect(warning("email", "abc@", {})).toBeTruthy();
    expect(warning("end", "2020.01", { start: "2021.01" })).toBeTruthy();
    expect(
      warning("end", "2020.01", { start: "2021.01", current: true }),
    ).toBeUndefined();
  });
  it("사진 없는 완성본은 90이며 모든 색 경계를 유지한다", () => {
    const resume = resumeFixture();
    for (const section of resume.content) {
      if (section.type === "basics") {
        section.data.name = "지우";
        section.data.jobTitle = "개발자";
        section.data.email = "jiwoo@resume.dev";
      } else if ("items" in section) {
        for (const item of section.items) {
          const field = {
            experience: "company",
            education: "school",
            projects: "name",
            certificates: "name",
            languages: "language",
          }[section.type];
          (item as unknown as Record<string, string>)[field] = "테스트 항목";
        }
      }
    }
    expect(completeness(resume.content).score).toBe(90);
    expect(completenessColor(49)).toBe("var(--danger)");
    expect(completenessColor(50)).toBe("var(--warn)");
    expect(completenessColor(79)).toBe("var(--warn)");
    expect(completenessColor(80)).toBe("var(--accent)");
  });
});
