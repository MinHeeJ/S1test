import { describe, expect, it } from "vitest";
import {
  deserializeResume,
  serializeResume,
  parseContent,
} from "../../src/domain/resume/serialization";
import { resumeFixture } from "../fixtures/resumeSeeds";

describe("이력서 JSON 구조와 왕복 보존", () => {
  it("8종, hidden/current, photoId null, 빈 필수값과 잘못된 날짜를 그대로 보존한다", () => {
    const original = resumeFixture();
    expect(deserializeResume(serializeResume(original))).toEqual(original);
  });
  it("파싱 결과는 입력 객체와 배열을 공유하지 않는다", () => {
    const original = resumeFixture();
    const parsed = parseContent(original.content);
    parsed[0].hidden = true;
    expect(original.content[0].hidden).toBe(false);
  });
  it.each([
    ["template", "invalid"],
    ["font", "invalid"],
    ["size", "invalid"],
    ["degree", "invalid"],
  ])("%s enum 불일치를 거부한다", (field, value) => {
    const input = JSON.parse(JSON.stringify(resumeFixture()));
    if (field === "template") input.template = value;
    else if (field === "degree") input.content[3].items[0].degree = value;
    else input.style[field] = value;
    expect(() => deserializeResume(JSON.stringify(input))).toThrow();
  });
  it("중복 종류를 거부한다", () => {
    const input = resumeFixture();
    input.content[7] = input.content[1];
    expect(() => serializeResume(input)).toThrow();
  });
  it("숨긴 basics를 거부한다", () => {
    const input = resumeFixture();
    input.content[0].hidden = true;
    expect(() => serializeResume(input)).toThrow();
  });
  it("basics 이동을 거부한다", () => {
    const input = resumeFixture();
    [input.content[0], input.content[1]] = [input.content[1], input.content[0]];
    expect(() => serializeResume(input)).toThrow();
  });
  it("items 대신 data가 사용된 항목 섹션을 거부한다", () => {
    const input = JSON.parse(JSON.stringify(resumeFixture()));
    input.content[2].data = {};
    delete input.content[2].items;
    expect(() => deserializeResume(JSON.stringify(input))).toThrow();
  });
  it.each(["hidden", "current"])("%s는 boolean이어야 한다", (field) => {
    const input = JSON.parse(JSON.stringify(resumeFixture()));
    if (field === "hidden") input.content[2].hidden = "true";
    else input.content[2].items[0].current = "true";
    expect(() => deserializeResume(JSON.stringify(input))).toThrow();
  });
  it.each([
    ["links", 4],
    ["tags", 31],
    ["items", 21],
  ] as const)("%s 개수 상한을 적용한다", (field, count) => {
    const input = JSON.parse(JSON.stringify(resumeFixture()));
    if (field === "links")
      input.content[0].data.links = Array(count).fill({ label: "", url: "" });
    if (field === "tags") input.content[4].data.tags = Array(count).fill("tag");
    if (field === "items")
      input.content[2].items = Array(count).fill(input.content[2].items[0]);
    expect(() => deserializeResume(JSON.stringify(input))).toThrow();
  });
});
