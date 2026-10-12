import { describe, expect, it } from "vitest";
import type { Resume } from "../../domain/resume/types";
import {
  completeness,
  missingFields,
  newItem,
  newSection,
  warning,
} from "./resumeFields";
import { resumeSeeds } from "../../../tests/fixtures/resumeSeeds";

describe("local-only required fields, warnings and completeness", () => {
  it("uses seed content rather than stored or invented scores", () => {
    expect(
      resumeSeeds
        .slice(0, 3)
        .map(completeness)
        .map((result) => result.score),
    ).toEqual([90, 90, 0]);
  });
  it("excludes hidden entries and treats zero items as required-field success", () => {
    const resume = structuredClone(resumeSeeds[0]);
    resume.content = [
      {
        type: "basics",
        hidden: false,
        data: { name: "이름", jobTitle: "직무", email: "a@b.co" },
      },
      { type: "experience", hidden: true, items: [{ company: "" }] },
      { type: "education", hidden: false, items: [] },
    ];
    expect(missingFields(resume)).toEqual([]);
    expect(completeness(resume).score).toBe(50);
    resume.content[1].hidden = false;
    expect(missingFields(resume)).toHaveLength(1);
    expect(completeness(resume).score).toBe(20);
  });
  it("counts raw Unicode summary content and validates email for PDF only", () => {
    const resume: Resume = {
      id: "23",
      title: "문서",
      template: "classic",
      style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
      content: [
        newSection("basics"),
        { type: "summary", hidden: false, data: { body: "\n " } },
      ],
    };
    expect(completeness(resume).score).toBe(10);
    expect(missingFields(resume)).toHaveLength(3);
    expect(warning("email", "abc@", {})).toContain("이메일");
    expect(warning("start", "2025.13", {})).toBe(
      "YYYY.MM 형식을 확인해 주세요",
    );
    expect(warning("end", "2024.01", { start: "2025.01" })).toBe(
      "종료일이 시작일보다 빠릅니다",
    );
    expect(
      warning("end", "2024.01", { start: "2025.01", current: true }),
    ).toBeUndefined();
  });
  it("creates complete empty fields and distinct string UUID item identities", () => {
    const first = newItem("experience");
    const second = newItem("experience");
    expect(first.id).not.toBe(second.id);
    expect(first.current).toBe(false);
    expect(first.end).toBe("");
    expect(newSection("skills")).toEqual({
      type: "skills",
      hidden: false,
      data: { tags: [] },
    });
  });
});
