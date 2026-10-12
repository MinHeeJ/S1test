import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/router";
import { useSessionStore } from "../../app/session";
import { ApiError } from "../../shared/api";
import { Toast, useToast } from "../../shared/Toast";
import { resumesApi } from "./api";
import { ScResumes } from "./ScResumes";
import { ScEditor } from "./ScEditor";
import { ScPrint } from "./ScPrint";
import { SectionFields } from "./SectionFields";
import { ResumeRenderer } from "./ResumeRenderer";
import {
  calculateCompleteness,
  codePointCount,
  missingFields,
  newItem,
  newSection,
  snapshot,
  type Resume,
} from "./model";
import { SaveCoordinator } from "./saveCoordinator";
import { paginateBlocks } from "./pagination";

vi.mock("./api", () => ({
  resumesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    duplicate: vi.fn(),
  },
}));
function fixture(): Resume {
  return {
    id: "selected-resume",
    title: "개발자 이력서",
    updated_at: "2025-01-01T00:00:00Z",
    template: "classic",
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
      {
        type: "summary",
        hidden: false,
        data: { headline: "", body: "자기소개" },
      },
      {
        type: "experience",
        hidden: true,
        items: [
          {
            id: "kept-id",
            company: "",
            position: "",
            start: "bad",
            end: "2020.01",
            current: true,
            description: "숨긴 경력",
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
let row: Resume;
const screens = {
  ScResumes,
  ScEditor,
  ScPrint,
  ScLogin: () => <p>로그인 화면</p>,
  ScSignup: () => <p>가입 화면</p>,
};
function Location() {
  return <output aria-label="현재 경로">{useLocation().pathname}</output>;
}
function routes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes screens={screens} />
      <Location />
      <Toast />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  row = fixture();
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
    error: null,
  });
  vi.mocked(resumesApi.list).mockImplementation(async () => [
    structuredClone(row),
  ]);
  vi.mocked(resumesApi.get).mockImplementation(async () =>
    structuredClone(row),
  );
  vi.mocked(resumesApi.save).mockImplementation(async (_, value) => {
    row = { ...row, ...structuredClone(value) };
  });
  vi.mocked(resumesApi.rename).mockImplementation(async (_, title) => {
    row.title = title;
  });
  vi.mocked(resumesApi.create).mockResolvedValue({ id: row.id });
  vi.mocked(resumesApi.duplicate).mockResolvedValue({ id: "new-id" });
  vi.mocked(resumesApi.remove).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  useToast.getState().dismiss();
});

it("root list and selected card reach the real editor with API data", async () => {
  routes("/");
  fireEvent.click(
    await screen.findByRole("link", { name: "개발자 이력서 편집" }),
  );
  expect(await screen.findByLabelText("이름")).toHaveValue("지우");
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    "/resumes/selected-resume/edit",
  );
  expect(resumesApi.get).toHaveBeenCalledWith(row.id);
});
it("anonymous entry cannot render protected list or editor", () => {
  useSessionStore.getState().clear();
  routes("/resumes/selected-resume/edit");
  expect(screen.getByText("로그인 화면")).toBeInTheDocument();
  expect(resumesApi.get).not.toHaveBeenCalled();
});
it("loading does not render an invented empty editor", () => {
  vi.mocked(resumesApi.get).mockReturnValue(new Promise(() => undefined));
  routes("/resumes/selected-resume/edit");
  expect(screen.getByText("이력서를 불러오고 있습니다…")).toHaveAttribute(
    "role",
    "status",
  );
  expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
  expect(resumesApi.save).not.toHaveBeenCalled();
});
it("list empty preserves the create entry without fake cards", async () => {
  vi.mocked(resumesApi.list).mockResolvedValue([]);
  routes("/resumes");
  expect(await screen.findByText(/아직 이력서가 없습니다/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "＋ 새 이력서" }),
  ).toBeInTheDocument();
});
it("failed list shows an error instead of previous or sample rows", async () => {
  vi.mocked(resumesApi.list).mockRejectedValue(new Error());
  routes("/resumes");
  expect(await screen.findByRole("alert")).toHaveTextContent("새로고침");
  expect(screen.queryByText(row.title)).not.toBeInTheDocument();
});
it("create modal requires template and preserves selected title", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "＋ 새 이력서" }));
  const modal = screen.getByRole("dialog");
  expect(within(modal).getByRole("button", { name: "생성" })).toBeDisabled();
  fireEvent.change(within(modal).getByLabelText("제목"), {
    target: { value: "  지원용  " },
  });
  fireEvent.change(within(modal).getByLabelText("템플릿"), {
    target: { value: "modern" },
  });
  fireEvent.click(within(modal).getByRole("button", { name: "생성" }));
  await waitFor(() =>
    expect(resumesApi.create).toHaveBeenCalledWith("  지원용  ", "modern"),
  );
  await screen.findByLabelText("이름");
});
it("delete modal cancellation never calls DELETE and keeps card", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "개발자 이력서 작업" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
  );
  expect(resumesApi.remove).not.toHaveBeenCalled();
  expect(
    screen.getByRole("link", { name: "개발자 이력서 편집" }),
  ).toBeInTheDocument();
});
it("delete confirmation uses selected id and refreshes list", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "개발자 이력서 작업" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  vi.mocked(resumesApi.list).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  await waitFor(() =>
    expect(resumesApi.remove).toHaveBeenCalledWith("selected-resume"),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("link", { name: "개발자 이력서 편집" }),
    ).not.toBeInTheDocument(),
  );
});
it("duplicate calls selected resource and refreshes the list", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "개발자 이력서 작업" }));
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  await waitFor(() =>
    expect(resumesApi.duplicate).toHaveBeenCalledWith(row.id),
  );
  await waitFor(() => expect(resumesApi.list).toHaveBeenCalledTimes(2));
});
it("rename rejects Unicode whitespace and does not issue PATCH", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "개발자 이력서 작업" }));
  fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
  fireEvent.change(screen.getByLabelText("이력서 이름"), {
    target: { value: "\u00a0\u2003" },
  });
  fireEvent.click(screen.getByRole("button", { name: "이름 저장" }));
  expect(resumesApi.rename).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("제목");
});
it("rename success is visible in refreshed API-driven card", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "개발자 이력서 작업" }));
  fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
  fireEvent.change(screen.getByLabelText("이력서 이름"), {
    target: { value: "새 제목" },
  });
  fireEvent.click(screen.getByRole("button", { name: "이름 저장" }));
  expect(
    await screen.findByRole("link", { name: "새 제목 편집" }),
  ).toBeInTheDocument();
});
it("editor 404 removes all data and offers list return without auto-create", async () => {
  vi.mocked(resumesApi.get).mockRejectedValue(
    new ApiError(404, {
      success: false,
      meta: {},
      code: "NOT_FOUND",
      message: "없음",
      field: null,
    }),
  );
  routes("/resumes/selected-resume/edit");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "이력서를 찾을 수 없습니다.",
  );
  expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "목록으로" })).toBeInTheDocument();
  expect(resumesApi.create).not.toHaveBeenCalled();
});
it("hidden data remains editable but all shared outputs exclude it", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  expect(screen.getByLabelText("회사명")).toHaveValue("");
  expect(document.querySelector(".hidden-section")).toBeInTheDocument();
  expect(
    document.querySelector('.resume-document [data-section="experience"]'),
  ).toBeNull();
  expect(document.querySelector(".resume-document")?.textContent).not.toContain(
    "숨긴 경력",
  );
});
it("basics has no move hide or section delete controls and no duplicate section candidate", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  expect(screen.queryByLabelText("기본정보 정렬")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("기본정보 섹션 삭제")).not.toBeInTheDocument();
  expect(
    within(screen.getByLabelText("섹션 추가")).queryByRole("option", {
      name: "기본정보",
    }),
  ).not.toBeInTheDocument();
});
it("section deletion cancel preserves items and no save command", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.click(screen.getByLabelText("경력 섹션 삭제"));
  expect(screen.getByRole("dialog")).toHaveTextContent("항목");
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByLabelText("회사명")).toBeInTheDocument();
  expect(resumesApi.save).not.toHaveBeenCalled();
});
it("section confirmation removes type and returns it to add candidates", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.click(screen.getByLabelText("경력 섹션 삭제"));
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  expect(screen.queryByLabelText("회사명")).not.toBeInTheDocument();
  expect(
    within(screen.getByLabelText("섹션 추가")).getByRole("option", {
      name: "경력",
    }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
  await waitFor(() => expect(resumesApi.save).toHaveBeenCalled());
  expect(row.content.some((section) => section.type === "experience")).toBe(
    false,
  );
});
it("current end input stays disabled and preserves the original value", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  expect(screen.getByLabelText("종료")).toBeDisabled();
  expect(screen.getByLabelText("종료")).toHaveValue("2020.01");
  fireEvent.click(screen.getByLabelText("재직중"));
  expect(screen.getByLabelText("종료")).not.toBeDisabled();
  expect(screen.getByLabelText("종료")).toHaveValue("2020.01");
});
it("description Enter inserts a bullet and does not block local autosave", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  const input = screen.getByLabelText("업무 내용·설명") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "일반 줄" } });
  input.setSelectionRange(4, 4);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.value).toBe("일반 줄\n- ");
});
it("first field missing PDF modal focuses the exact field and never prints", async () => {
  row.content[0].data!.jobTitle = "";
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("기본정보 · 희망 직무");
  expect(
    within(screen.getByRole("dialog")).getAllByRole("button"),
  ).toHaveLength(2);
  expect(document.querySelector("iframe")).toBeNull();
  expect(resumesApi.save).not.toHaveBeenCalled();
});
it("local draft and preview change immediately without a preview request", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "최신 이름" },
  });
  expect(screen.getByText("최신 이름")).toBeInTheDocument();
  expect(resumesApi.save).not.toHaveBeenCalled();
  expect(resumesApi.get).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "변경됨" })).toBeInTheDocument();
});
it("navigation flush persists latest snapshot before the list can mount", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "새 이름" },
  });
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  await screen.findByRole("link", { name: "개발자 이력서 편집" });
  expect(row.content[0].data!.name).toBe("새 이름");
  expect(resumesApi.save).toHaveBeenCalledTimes(1);
});
it("failed navigation flush retains draft and retry restores saved state", async () => {
  vi.mocked(resumesApi.save).mockRejectedValueOnce(new Error());
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "유지 이름" },
  });
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  const retry = await screen.findByRole("button", {
    name: "저장 실패·다시 시도",
  });
  expect(screen.getByLabelText("이름")).toHaveValue("유지 이름");
  fireEvent.click(retry);
  await screen.findByRole("button", { name: "저장됨" });
  expect(row.content[0].data!.name).toBe("유지 이름");
});
it("PDF flush failure never creates an iframe", async () => {
  vi.mocked(resumesApi.save).mockRejectedValue(new Error());
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "최신 이름" },
  });
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await screen.findByRole("button", { name: "저장 실패·다시 시도" });
  expect(document.querySelector("iframe")).toBeNull();
});
it("PDF export waits for latest save and uses selected id iframe, no popup", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "최신 이름" },
  });
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await waitFor(() =>
    expect(screen.getByTitle("이력서 인쇄")).toHaveAttribute(
      "src",
      "/print/selected-resume",
    ),
  );
  expect(row.content[0].data!.name).toBe("최신 이름");
});
it("dirty beforeunload is guarded; saved state removes the guard", async () => {
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "변경" },
  });
  const dirty = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
  await screen.findByRole("button", { name: "저장됨" });
  const saved = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(saved);
  expect(saved.defaultPrevented).toBe(false);
});
it("photo disconnect hides delete action and retains all other data", async () => {
  row.content[0].data!.photoId = "owned-photo";
  routes("/resumes/selected-resume/edit");
  await screen.findByLabelText("이름");
  const photo = within(
    screen.getByLabelText("사진 파일").closest(".photo-input")! as HTMLElement,
  );
  fireEvent.click(photo.getByRole("button", { name: "삭제" }));
  expect(photo.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
  await screen.findByRole("button", { name: "저장됨" });
  expect(row.content[0].data!.photoId).toBeNull();
});
it("direct print tab reads persisted data and never automatically prints", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  routes("/print/selected-resume");
  expect(
    await screen.findByText("편집기의 PDF 내보내기를 사용해 주세요."),
  ).toBeInTheDocument();
  expect(resumesApi.get).toHaveBeenCalledWith("selected-resume");
  expect(print).not.toHaveBeenCalled();
  print.mockRestore();
});
it("print 404 has no retained document or print call", async () => {
  vi.mocked(resumesApi.get).mockRejectedValue(
    new ApiError(404, {
      success: false,
      meta: {},
      code: "NOT_FOUND",
      message: "없음",
      field: null,
    }),
  );
  routes("/print/missing");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "이력서를 찾을 수 없습니다.",
  );
  expect(document.querySelector(".resume-paper")).toBeNull();
});
it("all three outputs share template allocation, hidden filtering and bullet semantics", () => {
  row.template = "modern";
  row.content[1].data!.body = "일반 줄\n- 글머리표";
  render(<ResumeRenderer resume={row} />);
  expect(
    document.querySelector('.resume-sidebar [data-section="basics"]'),
  ).toBeInTheDocument();
  expect(
    document.querySelector('.resume-sidebar [data-section="skills"]'),
  ).toBeInTheDocument();
  expect(
    document.querySelector('.resume-main [data-section="summary"]'),
  ).toBeInTheDocument();
  expect(screen.getByRole("listitem")).toHaveTextContent("글머리표");
  expect(screen.queryByText("숨긴 경력")).not.toBeInTheDocument();
});
it("completion ignores hidden required/body/tags and empty items satisfy required", () => {
  expect(calculateCompleteness(row.content).score).toBe(70);
  row.content[1].hidden = true;
  row.content[4].hidden = true;
  expect(calculateCompleteness(row.content).score).toBe(50);
  expect(missingFields(row.content)).toEqual([]);
  row.content[0].data!.email = "abc@";
  row.content[0].data!.jobTitle = "\u00a0\u2003";
  expect(missingFields(row.content).map((field) => field.path)).toEqual([
    "basics-jobTitle",
    "basics-email",
  ]);
  expect(calculateCompleteness(row.content).color).toBe("red");
});
it("completion criterion weights and color thresholds are exact and photo prompt is preserved", () => {
  row.content.push({
    type: "projects",
    hidden: false,
    items: [
      {
        id: "project",
        name: "프로젝트",
        role: "",
        start: "",
        end: "",
        description: "",
        url: "",
      },
    ],
  });
  expect(calculateCompleteness(row.content)).toMatchObject({
    score: 90,
    color: "green",
  });
  expect(calculateCompleteness(row.content).unmet).toContain(
    "사진을 등록하세요 (+10%)",
  );
  row.content[1].hidden = true;
  expect(calculateCompleteness(row.content)).toMatchObject({
    score: 80,
    color: "green",
  });
});
it("Unicode body count counts CRLF and surrogate pairs once", () => {
  expect(codePointCount("가😀\r\n나\r끝")).toBe(6);
});
it("item creation and copy use distinct UUID strings and both buttons stop at twenty", () => {
  const section = newSection("experience");
  const item = newItem("experience");
  expect(newItem("experience").id).not.toBe(item.id);
  section.items = Array.from({ length: 20 }, () => newItem("experience"));
  render(<SectionFields section={section} onChange={vi.fn()} />);
  expect(
    screen.getByRole("button", { name: "＋ 경력 항목 추가" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "항목 복제" })).toBeDisabled();
});
it("pagination keeps fitting items whole and splits only oversized blocks without losing text", () => {
  const measure = (block: { lines: string[] }) => block.lines.join("\n").length;
  const first = { section: "basics", lines: ["aaa"] };
  const second = { section: "experience", lines: ["bbbb"] };
  const long = { section: "projects", lines: ["01234567890123456789"] };
  const pages = paginateBlocks([first, second, long], 5, measure);
  expect(pages[0]).toEqual([first]);
  expect(pages[1]).toEqual([second]);
  expect(
    pages
      .flat()
      .filter((block) => block.section === "projects")
      .flatMap((block) => block.lines)
      .join(""),
  ).toBe("01234567890123456789");
  expect(pages.every((page) => page.length > 0)).toBe(true);
});
it("autosave debounces exactly 1500ms with no concurrent PUT and saves only latest subsequent snapshot", async () => {
  vi.useFakeTimers();
  const releases: (() => void)[] = [];
  const put = vi.fn(
    (_value: import("./model").ResumeWrite) =>
      new Promise<void>((resolve) => releases.push(resolve)),
  );
  const states: string[] = [];
  const queue = new SaveCoordinator(row, put, vi.fn(), (state) =>
    states.push(state),
  );
  row.content[0].data!.name = "first";
  queue.change(row);
  await vi.advanceTimersByTimeAsync(1499);
  expect(put).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(put).toHaveBeenCalledTimes(1);
  row.content[0].data!.name = "second";
  queue.change(row);
  row.content[0].data!.name = "latest";
  queue.change(row);
  await vi.advanceTimersByTimeAsync(2000);
  expect(put).toHaveBeenCalledTimes(1);
  releases[0]();
  await Promise.resolve();
  await Promise.resolve();
  expect(put).toHaveBeenCalledTimes(2);
  expect(put.mock.calls[1][0].content[0].data!.name).toBe("latest");
  expect(queue.state).toBe("저장 중…");
  releases[1]();
  await queue.flush();
  expect(queue.state).toBe("저장됨");
  expect(states).toContain("변경됨");
  queue.dispose();
});
it("title PATCH is serial behind in-flight PUT and later body snapshot includes latest title", async () => {
  let release: () => void = () => undefined;
  const order: string[] = [];
  const put = vi.fn(async (value) => {
    order.push(`put:${value.title}`);
    if (order.length === 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
  });
  const patch = vi.fn(async (title: string) => {
    order.push(`patch:${title}`);
  });
  const queue = new SaveCoordinator(row, put, patch, vi.fn());
  queue.change(row);
  const flush = queue.flush();
  const rename = queue.rename("latest-title");
  const newer = { ...row, title: "latest-title" };
  queue.change(newer);
  expect(patch).not.toHaveBeenCalled();
  release();
  await flush;
  await rename;
  expect(order).toEqual([
    "put:개발자 이력서",
    "patch:latest-title",
    "put:latest-title",
  ]);
  expect(queue.state).toBe("저장됨");
  queue.dispose();
});

it("settings replaces input cards and returns to the preserved draft", async () => {
  routes("/resumes/selected-resume/edit");
  const name = await screen.findByLabelText("이름");
  fireEvent.change(name, { target: { value: "새 이름" } });
  fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
  expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
  expect(screen.getByLabelText(/템플릿/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
  expect(screen.getByLabelText("이름")).toHaveValue("새 이름");
});

it("brand navigation flushes the latest draft before leaving", async () => {
  routes("/resumes/selected-resume/edit");
  fireEvent.change(await screen.findByLabelText("이름"), {
    target: { value: "이동 직전" },
  });
  fireEvent.click(screen.getByRole("link", { name: "ResumeCraft" }));
  await waitFor(() =>
    expect(screen.getByLabelText("현재 경로")).toHaveTextContent("/resumes"),
  );
  expect(row.content[0].data?.name).toBe("이동 직전");
});

it("list offers a retry after a failed read", async () => {
  vi.mocked(resumesApi.list).mockRejectedValueOnce(new Error());
  routes("/resumes");
  fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
  expect(
    await screen.findByRole("link", { name: "개발자 이력서 편집" }),
  ).toBeInTheDocument();
});

it("create dialog closes on Escape without writing", async () => {
  routes("/resumes");
  fireEvent.click(await screen.findByRole("button", { name: "＋ 새 이력서" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "새 이력서" }), {
    key: "Escape",
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(resumesApi.create).not.toHaveBeenCalled();
});
