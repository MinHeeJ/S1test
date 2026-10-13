import { expect, it } from "vitest";
import {
  completeness,
  completionColor,
  dateWarning,
  missingFields,
  newItem,
  nonblank,
} from "./content";
import { paginate } from "./pagination";
import { testResume } from "./testResume";

it("calculates 90 without a photo and treats hidden fields as absent, not deleted", () => {
  const r = testResume();
  expect(completeness(r.content).score).toBe(90);
  r.content[2].hidden = true;
  if (r.content[2].type === "experience") r.content[2].items[0].company = "";
  expect(missingFields(r.content)).toEqual([]);
  expect(completeness(r.content).score).toBe(70);
  r.content[1].hidden = true;
  r.content[4].hidden = true;
  expect(completeness(r.content).score).toBe(50);
  expect(completeness(r.content).criteria).toContain(
    "사진을 등록하세요 (+10%)",
  );
});
it("only required visible fields block printing, empty items satisfy the criterion", () => {
  const r = testResume();
  if (r.content[2].type === "experience") r.content[2].items = [];
  expect(missingFields(r.content)).toEqual([]);
  if (r.content[0].type === "basics") {
    r.content[0].data.jobTitle = "\u2003";
    r.content[0].data.email = "abc@";
  }
  expect(missingFields(r.content).map((f) => f.field)).toEqual([
    "jobTitle",
    "email",
  ]);
  expect(nonblank("\u00a0\u2003")).toBe(false);
  expect(dateWarning("2020.01", "2021.01")).not.toBeNull();
  expect(dateWarning("2020.13")).not.toBeNull();
});
it.each([
  [0, "red"],
  [50, "orange"],
  [79, "orange"],
  [80, "green"],
  [90, "green"],
])("maps completion %s to %s", (score, color) =>
  expect(completionColor(Number(score))).toBe(color),
);
it("new items receive unique UUIDs and preserve current/end as separate fields", () => {
  const a = newItem("experience");
  const b = newItem("experience");
  expect(a.id).not.toBe(b.id);
  expect(a.current).toBe(false);
  expect(a.end).toBe("");
});
it("pagination keeps ordinary entries indivisible and text appears on exactly one sheet", () => {
  expect(
    paginate(
      [
        { value: "one", height: 600 },
        { value: "two", height: 600 },
      ],
      1027,
    ),
  ).toEqual([["one"], ["two"]]);
});
