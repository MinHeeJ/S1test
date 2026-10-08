import { describe, expect, it } from "vitest";
import {
  deserializeContent,
  deserializeResume,
  serializeContent,
  serializeResume,
} from "../../src/domain/resume/serialization";
import { resumeSeeds } from "../fixtures/resumeSeeds";

describe("이력서 JSON 왕복", () => {
  it("8종 섹션, current, hidden, null photoId와 순서를 그대로 보존한다", () => {
    const content = deserializeContent(JSON.stringify(resumeSeeds[0].content));
    expect(deserializeContent(serializeContent(content))).toEqual(
      resumeSeeds[0].content,
    );
    expect(content.map((section) => section.type)).toEqual([
      "basics",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certificates",
      "languages",
    ]);
  });
  it("숨긴 항목, 빈 필수값 및 잘못된 이메일/날짜도 보존한다", () => {
    const content = JSON.parse(JSON.stringify(resumeSeeds[2].content));
    content[0].data.email = "abc@";
    content[1].items[0].start = "invalid-date";
    expect(deserializeContent(JSON.stringify(content))).toEqual(content);
  });
  it("template, font, size, degree 및 updated_at을 왕복 보존한다", () => {
    const resume = {
      ...resumeSeeds[0],
      id: "resume-fixture",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const decoded = deserializeResume(JSON.stringify(resume));
    expect(deserializeResume(serializeResume(decoded))).toEqual(resume);
  });
  it.each(["template", "font", "size", "degree"])(
    "허용되지 않은 %s enum을 거부한다",
    (field) => {
      const resume = JSON.parse(
        JSON.stringify({ ...resumeSeeds[0], id: "fixture" }),
      );
      if (field === "template") resume.template = "invalid";
      if (field === "font" || field === "size") resume.style[field] = "invalid";
      if (field === "degree") resume.content[3].items[0].degree = "invalid";
      expect(() => deserializeResume(JSON.stringify(resume))).toThrow(
        "INVALID_STRUCTURE",
      );
    },
  );
  it.each([
    "duplicate",
    "basics-hidden",
    "basics-order",
    "boolean",
    "items-kind",
    "item-count",
    "tags",
    "links",
  ])("구조 위반 %s를 거부한다", (rule) => {
    const content = JSON.parse(JSON.stringify(resumeSeeds[0].content));
    if (rule === "duplicate") content[1].type = "basics";
    if (rule === "basics-hidden") content[0].hidden = true;
    if (rule === "basics-order")
      [content[0], content[1]] = [content[1], content[0]];
    if (rule === "boolean") content[2].items[0].current = "true";
    if (rule === "items-kind") {
      delete content[2].items;
      content[2].data = {};
    }
    if (rule === "item-count")
      content[2].items = Array(21).fill(content[2].items[0]);
    if (rule === "tags") content[4].data.tags = Array(31).fill("tag");
    if (rule === "links")
      content[0].data.links = Array(4).fill({ label: "", url: "" });
    expect(() => deserializeContent(JSON.stringify(content))).toThrow(
      "INVALID_STRUCTURE",
    );
  });
});
