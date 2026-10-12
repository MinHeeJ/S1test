import { describe, expect, it } from "vitest";
import { resumeSeeds } from "../fixtures/resumeSeeds";
import {
  deserializeContent,
  deserializeResume,
  serializeContent,
  serializeResume,
} from "../../src/domain/resume/serialization";
import { FONT_SIZE_PT } from "../../src/domain/resume/types";

describe("JSON domain contract", () => {
  it("round trips all eight section kinds, order, hidden, booleans and nullable photoId", () => {
    const resume = structuredClone(resumeSeeds[0]);
    resume.content[1].hidden = true;
    expect(deserializeResume(serializeResume(resume))).toEqual(resume);
    expect(deserializeContent(serializeContent(resume.content))).toEqual(
      resume.content,
    );
    expect(resume.content.map((section) => section.type)).toEqual([
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

  it("preserves invalid email and date strings and empty user-required values", () => {
    const content = [
      {
        type: "basics",
        hidden: false,
        data: { jobTitle: "", email: "abc@", photoId: null },
      },
      {
        type: "experience",
        hidden: true,
        items: [{ current: true, start: "wrong", end: "2020.01" }],
      },
    ];
    expect(deserializeContent(JSON.stringify(content))).toEqual(content);
  });

  it("preserves missing optional nested fields instead of creating them", () => {
    const content = [{ type: "basics", hidden: false, data: {} }];
    expect(deserializeContent(JSON.stringify(content))).toEqual(content);
  });

  it.each(["template", "font", "size", "degree"])(
    "rejects mismatched %s enum",
    (field) => {
      const resume = structuredClone(resumeSeeds[0]) as any;
      if (field === "template") resume.template = "unknown";
      else if (field === "degree")
        resume.content.find(
          (s: any) => s.type === "education",
        ).items[0].degree = "unknown";
      else resume.style[field] = "unknown";
      expect(() => deserializeResume(JSON.stringify(resume))).toThrow(
        TypeError,
      );
    },
  );

  it.each([
    [{ type: "basics", hidden: true, data: {} }],
    [{ type: "unknown", hidden: false, data: {} }],
    [
      { type: "basics", hidden: false, data: {} },
      { type: "basics", hidden: false, data: {} },
    ],
    [{ type: "basics", hidden: false, items: [] }],
    [{ type: "basics", hidden: false, data: { photoId: false } }],
    [{ type: "basics", hidden: false, data: { links: Array(4).fill({}) } }],
    [
      { type: "basics", hidden: false, data: {} },
      { type: "skills", hidden: false, data: { tags: Array(31).fill("x") } },
    ],
    [
      { type: "basics", hidden: false, data: {} },
      { type: "experience", hidden: false, items: Array(21).fill({}) },
    ],
    [
      { type: "basics", hidden: false, data: {} },
      { type: "experience", hidden: false, items: [{ current: "true" }] },
    ],
  ])("rejects invalid section structure %#", (...sections) => {
    expect(() => deserializeContent(JSON.stringify(sections))).toThrow(
      TypeError,
    );
  });

  it("keeps the selected size enum separate from rendering point size", () => {
    expect(FONT_SIZE_PT).toEqual({ small: 9, medium: 10, large: 11 });
    expect(deserializeResume(serializeResume(resumeSeeds[0])).style.size).toBe(
      "medium",
    );
  });
});
