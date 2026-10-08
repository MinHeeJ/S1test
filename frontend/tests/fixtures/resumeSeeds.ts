import type { Resume } from "../../src/domain/resume/types";

/** Test-only JSON examples: never imported by application code or used as API responses. */
export function resumeFixture(): Resume {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "왕복 검증",
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
        hidden: false,
        data: { headline: "", body: "원문 본문" },
      },
      {
        type: "experience",
        hidden: true,
        items: [
          {
            id: "exp",
            company: "",
            position: "",
            start: "bad",
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
            id: "edu",
            school: "",
            major: "",
            degree: "",
            start: "2025.13",
            end: "",
            current: false,
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: { tags: ["Java", "React", "SQL"] },
      },
      {
        type: "projects",
        hidden: false,
        items: [
          {
            id: "proj",
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
        items: [{ id: "cert", name: "", issuer: "", date: "" }],
      },
      {
        type: "languages",
        hidden: false,
        items: [{ id: "lang", language: "", test: "", score: "" }],
      },
    ],
  };
}
