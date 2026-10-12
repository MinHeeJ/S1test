import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Resume } from "../../domain/resume/types";
import { apiClient, ApiRequestError } from "../../shared/apiClient";
import { resumeApi } from "./api";
import { resumeRoutes } from "./routes";
import { newSection } from "./resumeFields";
import { ResumeRenderer } from "./ResumeRenderer";
import { preparePrint } from "./PrintPage";

vi.mock("./api", () => ({
  resumeApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    duplicate: vi.fn(),
  },
}));
vi.mock("../../shared/apiClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../shared/apiClient")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() },
  };
});
let saved: Resume;
const value = (): Resume => ({
  id: "42",
  title: "서버 이력서",
  template: "classic",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  content: [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "지우",
        jobTitle: "개발자",
        email: "a@b.co",
        links: [],
        photoId: null,
      },
    },
    newSection("summary"),
    newSection("experience"),
    newSection("skills"),
  ],
  updated_at: "2025-01-01T00:00:00Z",
});
function mount(path: string) {
  const router = createMemoryRouter(
    [...resumeRoutes, { path: "/login", element: <h1>로그인</h1> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  vi.clearAllMocks();
  saved = value();
  vi.mocked(apiClient.get).mockResolvedValue({
    success: true,
    meta: {},
    data: { nickname: "지우" },
  });
  vi.mocked(apiClient.post).mockResolvedValue({ success: true, meta: {} });
  vi.mocked(resumeApi.list).mockImplementation(async () => ({
    success: true,
    meta: { page: 0, size: 20, totalPages: 1, totalElements: 1 },
    data: [structuredClone(saved)],
  }));
  vi.mocked(resumeApi.get).mockImplementation(async () => ({
    success: true,
    meta: {},
    data: structuredClone(saved),
  }));
  vi.mocked(resumeApi.save).mockImplementation(async (resume) => {
    saved = structuredClone(resume);
    return { success: true, meta: {} };
  });
  vi.mocked(resumeApi.rename).mockResolvedValue({ success: true, meta: {} });
  vi.mocked(resumeApi.remove).mockResolvedValue({ success: true, meta: {} });
  vi.mocked(resumeApi.duplicate).mockResolvedValue({
    success: true,
    meta: {},
    data: { id: "43" },
  });
  vi.mocked(resumeApi.create).mockResolvedValue({
    success: true,
    meta: {},
    data: { id: "43" },
  });
});
afterEach(() => vi.useRealTimers());
describe("authorized resume screens and local modal operations", () => {
  it("loads actual list projection and opens the selected card route without GET fan-out", async () => {
    const router = mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    expect(resumeApi.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("link", { name: "서버 이력서" })[0]);
    await screen.findByLabelText("이름");
    expect(router.state.location.pathname).toBe("/resumes/42/edit");
    expect(resumeApi.get).toHaveBeenCalledWith("42");
  });
  it("shows loading, empty and a usable creation entry rather than fixture cards", async () => {
    let done!: (result: Awaited<ReturnType<typeof resumeApi.list>>) => void;
    vi.mocked(resumeApi.list).mockReturnValue(
      new Promise((resolve) => {
        done = resolve;
      }),
    );
    mount("/resumes");
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
    await act(async () =>
      done({ success: true, meta: { totalPages: 0 }, data: [] }),
    );
    expect(
      screen.getByText("아직 이력서가 없습니다. 새 이력서를 작성해 보세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ 새 이력서" })).toBeEnabled();
  });
  it("displays list failure and retries explicitly", async () => {
    vi.mocked(resumeApi.list).mockRejectedValueOnce(
      new Error("서버 연결 실패"),
    );
    mount("/resumes");
    await screen.findByRole("alert");
    expect(
      screen.queryByText("아직 이력서가 없습니다."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findAllByRole("link", { name: "서버 이력서" });
  });
  it("requires an explicit template choice and server success before create navigation", async () => {
    const router = mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
    const modal = screen.getByRole("dialog", { name: "새 이력서 생성" });
    expect(within(modal).getByRole("button", { name: "생성" })).toBeDisabled();
    fireEvent.click(within(modal).getByLabelText("modern"));
    fireEvent.click(within(modal).getByRole("button", { name: "생성" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/resumes/43/edit"),
    );
    expect(resumeApi.create).toHaveBeenCalledWith("새 이력서", "modern");
  });
  it("keeps the create selection and shows a server template error beside its field", async () => {
    vi.mocked(resumeApi.create).mockRejectedValue(
      new ApiRequestError(400, {
        success: false,
        meta: {},
        code: "INVALID_TEMPLATE",
        message: "템플릿 오류",
        field: "template",
      }),
    );
    mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
    fireEvent.click(screen.getByLabelText("modern"));
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    await waitFor(() =>
      expect(screen.getByLabelText("modern")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    const choice = screen.getByLabelText("modern");
    expect(choice).toBeChecked();
    expect(
      document.getElementById(choice.getAttribute("aria-describedby")!),
    ).toHaveTextContent("템플릿 오류");
    expect(screen.getByLabelText("제목")).toHaveValue("새 이력서");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("cancel and Escape do not create or delete anything", async () => {
    mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(resumeApi.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "서버 이력서 메뉴" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
    );
    expect(resumeApi.remove).not.toHaveBeenCalled();
    expect(screen.getAllByRole("link", { name: "서버 이력서" })).toHaveLength(
      2,
    );
  });
  it("renames only the selected document and refreshes the list", async () => {
    vi.mocked(resumeApi.rename).mockImplementation(async (_id, title) => {
      saved.title = title;
      return { success: true, meta: {} };
    });
    mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "서버 이력서 메뉴" }));
    fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
    const modal = screen.getByRole("dialog");
    fireEvent.change(within(modal).getByLabelText("제목"), {
      target: { value: "변경한 제목" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: "저장" }));
    await screen.findAllByRole("link", { name: "변경한 제목" });
    expect(resumeApi.rename).toHaveBeenCalledWith("42", "변경한 제목");
  });
  it("duplicates without leaving the list and deletes only after explicit confirmation", async () => {
    const router = mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "서버 이력서 메뉴" }));
    fireEvent.click(screen.getByRole("button", { name: "복제" }));
    await waitFor(() => expect(resumeApi.list).toHaveBeenCalledTimes(2));
    expect(resumeApi.duplicate).toHaveBeenCalledWith("42");
    expect(router.state.location.pathname).toBe("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "서버 이력서 메뉴" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(resumeApi.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "확인" }),
    );
    await waitFor(() => expect(resumeApi.remove).toHaveBeenCalledWith("42"));
  });
  it("keeps a failed create modal and title, never automatically retrying POST", async () => {
    vi.mocked(resumeApi.create).mockRejectedValue(new Error("결과 미확정"));
    const router = mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
    fireEvent.click(screen.getByLabelText("classic"));
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    await screen.findByText("결과 미확정");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/resumes");
    expect(resumeApi.create).toHaveBeenCalledTimes(1);
  });
  it("paginates through the declared list API", async () => {
    vi.mocked(resumeApi.list).mockResolvedValue({
      success: true,
      meta: { totalPages: 2 },
      data: [saved],
    });
    mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(resumeApi.list).toHaveBeenLastCalledWith(1));
  });
});
describe("editor latest state and guarded departures", () => {
  it("marks required basics fields without blocking saves of incomplete content", async () => {
    mount("/resumes/42/edit");
    const name = await screen.findByLabelText("이름");
    for (const label of ["이름", "희망 직무", "이메일"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-required",
        "true",
      );
      expect(screen.getByLabelText(label)).not.toHaveAttribute("required");
    }
    expect(screen.getByLabelText("전화번호")).not.toHaveAttribute(
      "aria-required",
      "true",
    );
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(
      saved.content[0].type === "basics" && saved.content[0].data.name,
    ).toBe("");
  });
  it("redirects the parent editor only for a trusted print-frame unauthorized message", async () => {
    const router = mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );
    const frame = document.querySelector("iframe")!;
    const send = (origin: string, source: MessageEventSource | null) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: "resume-print-unauthorized",
          origin,
          source,
        }),
      );
    act(() => send("https://untrusted.invalid", frame.contentWindow));
    act(() => send(window.location.origin, window));
    expect(router.state.location.pathname).toBe("/resumes/42/edit");
    act(() => send(window.location.origin, frame.contentWindow));
    await screen.findByRole("heading", { name: "로그인" });
    expect(router.state.location.pathname).toBe("/login");
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("edits current memory and flushes the latest payload before list navigation", async () => {
    const router = mount("/resumes/42/edit");
    const input = await screen.findByLabelText("이름");
    fireEvent.change(input, { target: { value: "최신 이름" } });
    expect(screen.getByText("변경됨")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/resumes"),
    );
    const basics = saved.content[0];
    expect(basics.type === "basics" && basics.data.name).toBe("최신 이름");
  });
  it("keeps local edits and stays when flush fails, then explicit retry succeeds", async () => {
    vi.mocked(resumeApi.save).mockRejectedValueOnce(new Error("저장 실패"));
    const router = mount("/resumes/42/edit");
    const input = await screen.findByLabelText("이름");
    fireEvent.change(input, { target: { value: "보존할 내용" } });
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(router.state.location.pathname).toBe("/resumes/42/edit");
    expect(input).toHaveValue("보존할 내용");
    fireEvent.click(
      screen.getByRole("button", { name: "저장 실패·다시 시도" }),
    );
    await screen.findByText("저장됨");
    expect(resumeApi.save).toHaveBeenCalledTimes(2);
  });
  it("changes style without dropping content and switches mobile tab locally", async () => {
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    fireEvent.change(screen.getByLabelText("템플릿"), {
      target: { value: "modern" },
    });
    fireEvent.click(screen.getByRole("button", { name: "#2563EB" }));
    fireEvent.change(screen.getByLabelText("글자 크기"), {
      target: { value: "large" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "미리보기" }));
    expect(screen.getByRole("tab", { name: "미리보기" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await waitFor(() => expect(resumeApi.save).toHaveBeenCalled());
    expect(saved.template).toBe("modern");
    expect(saved.style.color).toBe("#2563EB");
    expect(saved.content[0]).toEqual(value().content[0]);
  });
  it("requires section deletion confirmation and keeps hidden section data editable", async () => {
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    const summary = screen.getByLabelText("본문");
    fireEvent.change(summary, { target: { value: "보관 원문" } });
    const summaryCard = summary.closest(".section-card")! as HTMLElement;
    fireEvent.click(within(summaryCard).getByRole("button", { name: "숨김" }));
    expect(summaryCard).toHaveClass("section-hidden");
    expect(summary).toBeEnabled();
    fireEvent.click(
      within(summaryCard).getByRole("button", { name: "섹션 삭제" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
    );
    expect(summary).toHaveValue("보관 원문");
    fireEvent.click(
      within(summaryCard).getByRole("button", { name: "섹션 삭제" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "확인" }),
    );
    expect(screen.queryByLabelText("본문")).not.toBeInTheDocument();
  });
  it("preserves end on current toggle and immediately deletes items without modal", async () => {
    saved.content[2] = {
      type: "experience",
      hidden: false,
      items: [{ id: "item", company: "회사", end: "2024.01" }],
    };
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "회사 · 2024.01" }));
    const end = screen.getByLabelText("종료");
    fireEvent.click(screen.getByLabelText("재직중"));
    expect(end).toBeDisabled();
    expect(end).toHaveValue("2024.01");
    fireEvent.click(screen.getByLabelText("재직중"));
    expect(end).toBeEnabled();
    expect(end).toHaveValue("2024.01");
    fireEvent.click(screen.getByRole("button", { name: "항목 삭제" }));
    expect(screen.queryByLabelText("회사명")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("shows missing fields and focuses the actual input, never creating a print iframe", async () => {
    saved.content[0] = {
      type: "basics",
      hidden: false,
      data: { name: "이름", jobTitle: "", email: "a@b.co" },
    };
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    expect(
      screen.getByRole("dialog", { name: "빠진 항목" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "기본정보 · 희망 직무" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("희망 직무")).toHaveFocus(),
    );
    expect(document.querySelector("iframe")).toBeNull();
    expect(resumeApi.save).not.toHaveBeenCalled();
  });
  it("keeps a rejected title draft and shows its server field error", async () => {
    vi.mocked(resumeApi.rename).mockRejectedValue(
      new ApiRequestError(400, {
        success: false,
        meta: {},
        code: "INVALID_TITLE",
        message: "제목 오류",
        field: "title",
      }),
    );
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "서버 이력서" }));
    const title = screen.getByLabelText("이력서 제목");
    fireEvent.change(title, { target: { value: "거부된 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "제목 저장" }));
    await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"));
    expect(
      document.getElementById(title.getAttribute("aria-describedby")!),
    ).toHaveTextContent("제목 오류");
    expect(title).toHaveValue("거부된 제목");
    expect(saved.title).toBe("서버 이력서");
  });
  it("opens the photo file picker from the photo-area CTA without uploading on cancellation", async () => {
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    const file = screen.getByLabelText("사진 등록·변경");
    const clicked = vi.fn();
    file.addEventListener("click", clicked);
    fireEvent.click(screen.getByRole("button", { name: "사진 등록" }));
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByText("저장됨")).toBeInTheDocument();
  });
  it("does not print if dirty save fails", async () => {
    vi.mocked(resumeApi.save).mockRejectedValueOnce(new Error("실패"));
    mount("/resumes/42/edit");
    const input = await screen.findByLabelText("이름");
    fireEvent.change(input, { target: { value: "새 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("saves before logout and never invalidates the session on a save failure", async () => {
    vi.mocked(resumeApi.save).mockRejectedValueOnce(new Error("실패"));
    const router = mount("/resumes/42/edit");
    const input = await screen.findByLabelText("이름");
    fireEvent.change(input, { target: { value: "새 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/resumes/42/edit");
  });
  it("prompts on beforeunload only while dirty", async () => {
    mount("/resumes/42/edit");
    const input = await screen.findByLabelText("이름");
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(input, { target: { value: "수정" } });
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
  it("shows same-route 404 without editable document and redirects expired session to login", async () => {
    vi.mocked(resumeApi.get).mockRejectedValueOnce(
      new ApiRequestError(404, {
        success: false,
        meta: {},
        code: "404",
        message: "없음",
        field: null,
      }),
    );
    const router = mount("/resumes/999/edit");
    await screen.findByText("자료를 찾을 수 없습니다.");
    expect(router.state.location.pathname).toBe("/resumes/999/edit");
    expect(screen.queryByLabelText("이름")).toBeNull();
    const unavailable = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unavailable);
    expect(unavailable.defaultPrevented).toBe(false);
  });
});
describe("workspace recovery and section disclosure", () => {
  it("retries a failed editor read without navigating away or creating a document", async () => {
    vi.mocked(resumeApi.get).mockRejectedValueOnce(
      new Error("일시적 조회 실패"),
    );
    const router = mount("/resumes/42/edit");
    await screen.findByText("일시적 조회 실패");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByLabelText("이름");
    expect(router.state.location.pathname).toBe("/resumes/42/edit");
    expect(resumeApi.create).not.toHaveBeenCalled();
  });
  it("collapses a section without changing its stored data and restores fields on expand", async () => {
    mount("/resumes/42/edit");
    await screen.findByLabelText("이름");
    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "그대로 보존" },
    });
    fireEvent.click(screen.getByRole("button", { name: "자기소개 접기" }));
    expect(screen.queryByLabelText("본문")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "자기소개 펼치기" }));
    expect(screen.getByLabelText("본문")).toHaveValue("그대로 보존");
    expect(resumeApi.save).not.toHaveBeenCalled();
  });
  it("shows an automatic save error toast and keeps the latest input", async () => {
    mount("/resumes/42/edit");
    const input = await screen.findByLabelText("이름");
    vi.useFakeTimers();
    vi.mocked(resumeApi.save).mockRejectedValueOnce(
      new Error("자동저장 연결 실패"),
    );
    fireEvent.change(input, { target: { value: "실패해도 유지" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText("자동저장 연결 실패")).toBeInTheDocument();
    expect(input).toHaveValue("실패해도 유지");
    expect(
      screen.getByRole("button", { name: "저장 실패·다시 시도" }),
    ).toBeEnabled();
  });
  it("dismisses the selected card menu with Escape from its trigger", async () => {
    mount("/resumes");
    await screen.findAllByRole("link", { name: "서버 이력서" });
    const trigger = screen.getByRole("button", { name: "서버 이력서 메뉴" });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "복제" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("shared paper renderer and print server readback", () => {
  it("excludes hidden sections, renders current instead of end and uses the same A4 structure", () => {
    const resume = value();
    resume.content.push({
      type: "experience",
      hidden: true,
      items: [{ company: "숨긴 회사" }],
    });
    render(<ResumeRenderer resume={resume} />);
    expect(screen.queryByText("숨긴 회사")).toBeNull();
    expect(screen.getByLabelText("A4 1페이지")).toBeInTheDocument();
  });
  it("loads print route from the server, not the editor memory", async () => {
    mount("/print/42");
    await screen.findByLabelText("A4 1페이지");
    expect(resumeApi.get).toHaveBeenCalledWith("42");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("rejects PDF when no real document font is supplied instead of printing a fallback silently", async () => {
    const original = document.fonts;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: Promise.resolve(),
        forEach: () => undefined,
      },
    });
    await expect(
      preparePrint(document.createElement("div"), value()),
    ).rejects.toThrow("글꼴");
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: original,
    });
  });
});
