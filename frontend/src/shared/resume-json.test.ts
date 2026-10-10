import { describe, expect, it } from "vitest";
import {
  deserializeResume,
  serializeResume,
} from "../domain/resume/serialization";
import type { Resume } from "../domain/resume/types";

function fixture(): Resume {
  return {
    id: "fixture-resume",
    title: "부분 작성",
    template: "modern",
    style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "",
          jobTitle: "",
          email: "abc@",
          phone: "",
          links: [{ label: "", url: "" }],
          photoId: null,
        },
      },
      {
        type: "summary",
        hidden: true,
        data: {
          headline: "",
          body: `공백과
개행 😀`,
        },
      },
      {
        type: "experience",
        hidden: true,
        items: [
          {
            id: "experience-item",
            company: "",
            position: "",
            start: "bad",
            end: "2020.01",
            current: true,
            description: "",
          },
        ],
      },
      {
        type: "education",
        hidden: false,
        items: [
          {
            id: "education-item",
            school: "",
            major: "",
            degree: "",
            start: "",
            end: "",
            current: false,
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: { tags: ["Java", "JAVA", "한글"] },
      },
      {
        type: "projects",
        hidden: false,
        items: [
          {
            id: "project-item",
            name: "",
            role: "",
            start: "2025.02",
            end: "2020.01",
            description: "",
            url: "",
          },
        ],
      },
      {
        type: "certificates",
        hidden: false,
        items: [{ id: "certificate-item", name: "", issuer: "", date: "bad" }],
      },
      {
        type: "languages",
        hidden: false,
        items: [{ id: "language-item", language: "", test: "", score: "" }],
      },
    ],
  };
}

describe("resume JSON structural round-trip", () => {
  it("preserves every field of all eight kinds, hidden data and partial warning values", () => {
    const resume = fixture();
    expect(deserializeResume(serializeResume(resume))).toEqual(resume);
  });
  it.each(["고졸", "학사", "석사", "박사", ""])(
    "preserves education degree %s",
    (degree) => {
      const value = fixture();
      const education = value.content.find(
        (section) => section.type === "education",
      )!;
      education.items[0].degree =
        degree as (typeof education.items)[0]["degree"];
      expect(deserializeResume(serializeResume(value))).toEqual(value);
    },
  );
  it.each(["template", "font", "size", "degree"])(
    "rejects unknown %s enum",
    (field) => {
      const raw = JSON.parse(JSON.stringify(fixture()));
      if (field === "template") raw.template = "unknown";
      else if (field === "degree") raw.content[3].items[0].degree = "unknown";
      else raw.style[field] = "unknown";
      expect(() => deserializeResume(JSON.stringify(raw))).toThrow();
    },
  );
  it("rejects duplicate section types", () => {
    const value = fixture();
    value.content[7] = value.content[6];
    expect(() => serializeResume(value)).toThrow();
  });
  it("rejects hidden basics", () => {
    const value = fixture();
    value.content[0].hidden = true;
    expect(() => serializeResume(value)).toThrow();
  });
  it("rejects numeric string fields rather than coercing them", () => {
    const raw = JSON.parse(JSON.stringify(fixture()));
    raw.content[0].data.name = 7;
    expect(() => deserializeResume(JSON.stringify(raw))).toThrow();
  });
  it("rejects data/items shape mismatches", () => {
    const raw = JSON.parse(JSON.stringify(fixture()));
    raw.content[2].data = {};
    expect(() => deserializeResume(JSON.stringify(raw))).toThrow();
  });
  it("rejects string current flags", () => {
    const raw = JSON.parse(JSON.stringify(fixture()));
    raw.content[2].items[0].current = "true";
    expect(() => deserializeResume(JSON.stringify(raw))).toThrow();
  });
  it("preserves a non-null photo reference", () => {
    const raw = JSON.parse(JSON.stringify(fixture()));
    raw.content[0].data.photoId = "62d6d780-eedc-46d7-a69b-a0c31498efc1";
    expect(deserializeResume(JSON.stringify(raw))).toEqual(raw);
  });
});
