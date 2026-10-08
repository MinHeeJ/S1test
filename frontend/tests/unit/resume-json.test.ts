import { describe, expect, it } from "vitest";
import {
  deserializeResume,
  serializeResume,
} from "../../src/domain/resume/serialization";
import type { Resume } from "../../src/domain/resume/types";

const resume: Resume = {
  id: "test-resume",
  title: "시험 이력서",
  template: "modern",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  updated_at: "2026-01-01T00:00:00Z",
  content: [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "",
        jobTitle: "",
        email: "abc@",
        phone: "",
        links: [],
        photoId: null,
      },
    },
    {
      type: "summary",
      hidden: false,
      data: { headline: "", body: "본문\n보존" },
    },
    {
      type: "experience",
      hidden: true,
      items: [
        {
          id: "experience",
          company: "",
          position: "",
          start: "bad-date",
          end: "2020.01",
          current: true,
          description: "숨김 보존",
        },
      ],
    },
    {
      type: "education",
      hidden: false,
      items: [
        {
          id: "education",
          school: "",
          major: "",
          degree: "",
          start: "",
          end: "",
          current: false,
        },
      ],
    },
    { type: "skills", hidden: false, data: { tags: ["Java", "React"] } },
    {
      type: "projects",
      hidden: false,
      items: [
        {
          id: "project",
          name: "",
          role: "",
          start: "",
          end: "",
          description: "",
          url: "",
        },
      ],
    },
    {
      type: "certificates",
      hidden: false,
      items: [{ id: "certificate", name: "", issuer: "", date: "invalid" }],
    },
    {
      type: "languages",
      hidden: false,
      items: [{ id: "language", language: "", test: "", score: "" }],
    },
  ],
};

describe("resume JSON contract", () => {
  it("preserves all eight section shapes, order, nulls and non-blocking invalid field values", () => {
    expect(deserializeResume(serializeResume(resume))).toEqual(resume);
  });
  it.each(["template", "font", "size"])("rejects invalid %s enum", (field) => {
    const copy = JSON.parse(serializeResume(resume));
    if (field === "template") copy.template = "other";
    else copy.style[field] = "other";
    expect(() => deserializeResume(JSON.stringify(copy))).toThrow();
  });
  it("rejects duplicate kinds", () => {
    const copy = structuredClone(resume);
    copy.content[1] = copy.content[0];
    expect(() => deserializeResume(JSON.stringify(copy))).toThrow();
  });
  it("rejects hidden basics", () => {
    const copy = structuredClone(resume);
    copy.content[0].hidden = true;
    expect(() => deserializeResume(JSON.stringify(copy))).toThrow();
  });
  it("rejects string current instead of boolean", () => {
    const copy = JSON.parse(serializeResume(resume));
    copy.content[2].items[0].current = "true";
    expect(() => deserializeResume(JSON.stringify(copy))).toThrow();
  });
  it("rejects invalid degree", () => {
    const copy = JSON.parse(serializeResume(resume));
    copy.content[3].items[0].degree = "other";
    expect(() => deserializeResume(JSON.stringify(copy))).toThrow();
  });
  it.each([
    ["items", 21],
    ["tags", 31],
    ["links", 4],
  ])("rejects %s count overflow", (kind, count) => {
    const copy = JSON.parse(serializeResume(resume));
    if (kind === "items")
      copy.content[2].items = Array(Number(count)).fill(
        copy.content[2].items[0],
      );
    if (kind === "tags")
      copy.content[4].data.tags = Array(Number(count)).fill("tag");
    if (kind === "links")
      copy.content[0].data.links = Array(Number(count)).fill({
        label: "",
        url: "",
      });
    expect(() => deserializeResume(JSON.stringify(copy))).toThrow();
  });
  it("rejects malformed JSON", () => {
    expect(() => deserializeResume("{")).toThrow();
  });
});
