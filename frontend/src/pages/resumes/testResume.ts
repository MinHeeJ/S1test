import type { Resume } from "../../shared/contracts";

export function testResume(): Resume {
  return {
    id: "27",
    title: "지원용",
    template: "classic",
    updated_at: "2026-01-01T00:00:00Z",
    style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
    content: [
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
      { type: "summary", hidden: false, data: { headline: "", body: "소개" } },
      {
        type: "experience",
        hidden: false,
        items: [
          {
            id: "entry",
            company: "회사",
            position: "개발자",
            start: "2020.01",
            end: "2021.01",
            current: false,
            description: "설명\n- 항목",
          },
        ],
      },
      { type: "education", hidden: false, items: [] },
      {
        type: "skills",
        hidden: false,
        data: { tags: ["Java", "SQL", "React"] },
      },
    ],
  };
}
