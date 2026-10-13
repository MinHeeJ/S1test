import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Content } from "../../shared/contracts";
import { SectionPanel } from "./SectionPanel";
import { resumesApi } from "./resumesApi";
import { testResume } from "./testResume";

vi.mock("./resumesApi", () => ({ resumesApi: { uploadPhoto: vi.fn() } }));
afterEach(() => vi.resetAllMocks());
let current: Content;
function Panel({ initial = testResume().content }: { initial?: Content }) {
  const [content, setContent] = useState(initial);
  current = content;
  return <SectionPanel content={content} change={setContent} focus={null} />;
}
it("basics has no hide, move or delete action; candidates exclude all existing types", () => {
  render(<Panel />);
  expect(
    screen.queryByRole("button", { name: "기본정보 숨김 전환" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "기본정보 순서 이동" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "기본정보 섹션 삭제" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "+ 섹션 추가" }));
  expect(
    screen.queryByRole("button", { name: "경력" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "프로젝트" }));
  expect(current.filter((s) => s.type === "projects")).toHaveLength(1);
});
it("hidden input data stays present while hide toggles only its state", () => {
  render(<Panel />);
  fireEvent.click(screen.getByRole("button", { name: "경력 숨김 전환" }));
  expect(current[2]).toMatchObject({
    hidden: true,
    items: [{ company: "회사" }],
  });
  expect(document.querySelector(".section-hidden")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "경력 숨김 전환" }));
  expect(current[2]).toMatchObject({
    hidden: false,
    items: [{ company: "회사" }],
  });
});
it("section deletion requires confirmation; cancellation retains items and confirmation removes both", async () => {
  render(<Panel />);
  fireEvent.click(screen.getByRole("button", { name: "경력 섹션 삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
  );
  expect(current[2]).toMatchObject({
    type: "experience",
    items: [{ company: "회사" }],
  });
  fireEvent.click(screen.getByRole("button", { name: "경력 섹션 삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  await waitFor(() =>
    expect(current.some((s) => s.type === "experience")).toBe(false),
  );
});
it("item copy preserves values but creates unique identity; deletion is immediate without modal", () => {
  render(<Panel />);
  fireEvent.click(screen.getByRole("button", { name: "항목 복제" }));
  const section = current[2];
  if (section.type !== "experience") throw new Error("section");
  expect(section.items).toHaveLength(2);
  expect(section.items[1].id).not.toBe(section.items[0].id);
  expect(section.items[1].company).toBe(section.items[0].company);
  fireEvent.click(screen.getAllByRole("button", { name: "항목 삭제" })[0]);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(current[2]).toMatchObject({ items: [{ id: section.items[1].id }] });
});
it("20 entries disable both copy and addition and links stop at three", () => {
  const content = testResume().content;
  if (content[2].type === "experience") {
    const item = content[2].items[0];
    content[2].items = Array.from({ length: 20 }, (_, i) => ({
      ...item,
      id: `id-${i}`,
    }));
  }
  render(<Panel initial={content} />);
  for (const button of screen.getAllByRole("button", { name: "항목 복제" }))
    expect(button).toBeDisabled();
  expect(
    screen.getAllByRole("button", { name: "+ 항목 추가" })[0],
  ).toBeDisabled();
  for (let i = 0; i < 3; i++)
    fireEvent.click(screen.getByRole("button", { name: "링크 추가" }));
  expect(screen.getByRole("button", { name: "링크 추가" })).toBeDisabled();
  fireEvent.click(screen.getAllByRole("button", { name: "링크 삭제" })[0]);
  expect(screen.getByRole("button", { name: "링크 추가" })).not.toBeDisabled();
});
it("current disables end without losing its original text; date errors stay warnings", () => {
  render(<Panel />);
  fireEvent.click(
    screen.getByRole("button", { name: "회사 · 개발자 · 2020.01 ~ 2021.01" }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "재직중" }));
  expect(screen.getByLabelText("종료")).toBeDisabled();
  expect(screen.getByLabelText("종료")).toHaveValue("2021.01");
  fireEvent.click(screen.getByRole("checkbox", { name: "재직중" }));
  expect(screen.getByLabelText("종료")).not.toBeDisabled();
  fireEvent.change(screen.getByLabelText("종료"), {
    target: { value: "2019.01" },
  });
  expect(screen.getByText("종료일이 시작일보다 빠릅니다.")).toBeInTheDocument();
  expect(current[2]).toMatchObject({ items: [{ end: "2019.01" }] });
});
it("description Enter inserts a bullet prefix while preserving following text", () => {
  render(<Panel />);
  fireEvent.click(
    screen.getByRole("button", { name: "회사 · 개발자 · 2020.01 ~ 2021.01" }),
  );
  const input = screen.getByLabelText("설명") as HTMLTextAreaElement;
  input.setSelectionRange(2, 2);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("설명\n- \n- 항목");
});
it("tags reject exact duplicate and thirty-first tag, with inline messages only", () => {
  const content = testResume().content;
  if (content[4].type === "skills")
    content[4].data.tags = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
  render(<Panel initial={content} />);
  fireEvent.change(screen.getByLabelText("기술 태그"), {
    target: { value: "tag-0" },
  });
  fireEvent.keyDown(screen.getByLabelText("기술 태그"), { key: "Enter" });
  expect(screen.getByText("이미 등록한 태그입니다.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("기술 태그"), {
    target: { value: "new" },
  });
  fireEvent.keyDown(screen.getByLabelText("기술 태그"), { key: "Enter" });
  expect(screen.getByText("태그는 최대 30개입니다.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("failed photo upload preserves old linkage; deletion only changes photoId to null", async () => {
  const content = testResume().content;
  if (content[0].type === "basics") content[0].data.photoId = "old-photo";
  vi.mocked(resumesApi.uploadPhoto).mockRejectedValue(new Error("실패"));
  render(<Panel initial={content} />);
  fireEvent.change(screen.getByLabelText("사진 등록·변경"), {
    target: {
      files: [new File(["bytes"], "image.png", { type: "image/png" })],
    },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("사진 등록·변경")).not.toBeDisabled(),
  );
  expect(current[0]).toMatchObject({ data: { photoId: "old-photo" } });
  fireEvent.click(screen.getByRole("button", { name: "사진 삭제" }));
  expect(current[0]).toMatchObject({ data: { photoId: null } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("photo success keeps text edits made during upload and links new photo without rollback illusion", async () => {
  let release!: (result: { photoId: string }) => void;
  vi.mocked(resumesApi.uploadPhoto).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  render(<Panel />);
  fireEvent.change(screen.getByLabelText("사진 등록·변경"), {
    target: {
      files: [new File(["bytes"], "image.png", { type: "image/png" })],
    },
  });
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "최신 이름" },
  });
  release({ photoId: "new-photo" });
  await waitFor(() =>
    expect(current[0]).toMatchObject({
      data: { name: "최신 이름", photoId: "new-photo" },
    }),
  );
});
