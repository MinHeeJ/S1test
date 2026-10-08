import { describe, expect, it } from "vitest";
import { resumeSeeds } from "../fixtures/resumeSeeds";
import { deserializeResume } from "../../src/domain/resume/serialization";
import type { ResumeContent } from "../../src/domain/resume/types";

// Independent seed oracle checks the specification's sum; product completeness belongs to the editor.
function seedScore(content: ResumeContent): number {
  const visible = content.filter((section) => !section.hidden);
  const basics = visible.find((section) => section.type === "basics");
  if (basics?.type !== "basics") return 0;
  const nonempty = (text: string) => text.trim().length > 0;
  const required =
    nonempty(basics.data.name) &&
    nonempty(basics.data.jobTitle) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basics.data.email) &&
    visible.every((section) => {
      if (!("items" in section)) return true;
      return section.items.every((item) => {
        if ("company" in item) return nonempty(item.company);
        if ("school" in item) return nonempty(item.school);
        if ("name" in item) return nonempty(item.name);
        return nonempty(item.language);
      });
    });
  const summary = visible.find((section) => section.type === "summary");
  const skills = visible.find((section) => section.type === "skills");
  return (
    (required ? 50 : 0) +
    (summary?.type === "summary" && nonempty(summary.data.body) ? 10 : 0) +
    (visible.some(
      (section) =>
        (section.type === "experience" || section.type === "projects") &&
        section.items.length > 0,
    )
      ? 20
      : 0) +
    (skills?.type === "skills" && skills.data.tags.length >= 3 ? 10 : 0) +
    (basics.data.photoId ? 10 : 0)
  );
}

describe("database demo content fixture", () => {
  it("contains five structurally valid resumes and the three Jiwoo scores are derived, not persisted", () => {
    const resumes = resumeSeeds.map((seed) =>
      deserializeResume(JSON.stringify(seed)),
    );
    expect(resumes).toHaveLength(5);
    expect(
      resumes.slice(0, 3).map((resume) => seedScore(resume.content)),
    ).toEqual([90, 90, 0]);
    expect(resumeSeeds[4].deleted).toBe(true);
    expect(
      resumes.every(
        (resume) =>
          resume.content[0].type === "basics" &&
          resume.content[0].data.photoId === null,
      ),
    ).toBe(true);
  });
});
