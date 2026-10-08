import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { ApiRequestError, request } from "../../shared/http";
import { resumeRoutes } from "./resumeRoutes";
import { ResumeRenderer, paginateResumeBlocks } from "./ResumeRenderer";
import { PrintPage } from "./PrintPage";

vi.mock("../../shared/http", async () => {
  const actual = await vi.importActual("../../shared/http");
  return { ...actual, request: vi.fn() };
});
const api = vi.mocked(request);
const original: Resume = {
  id: "selected-resume",
  title: "지우 이력서",
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
      data: { headline: "", body: "원본 본문" },
    },
    {
      type: "experience",
      hidden: true,
      items: [
        {
          id: "existing-item",
          company: "",
          position: "",
          start: "2022.01",
          end: "2021.01",
          current: false,
          description: "숨긴 내용",
        },
      ],
    },
  ],
  updated_at: "2026-01-01T00:00:00Z",
};
let row: Resume;
let failSave = false;
let empty = false;
function mount(path = "/resumes") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {resumeRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="/login" element={<h1>Login</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  row = structuredClone(original);
  failSave = false;
  empty = false;
  api.mockReset();
  api.mockImplementation(async (path, init) => {
    if (path === "/api/auth/me")
      return { success: true, meta: {}, data: { nickname: "지우" } };
    if (path === "/api/auth/logout") return { success: true, meta: {} };
    if (path.startsWith("/api/resumes?"))
      return { success: true, meta: {}, data: empty ? [] : [row] };
    if (path === "/api/resumes" && init?.method === "POST") {
      const input = JSON.parse(init.body as string);
      row = { ...row, ...input, id: "created-resume" };
      return { success: true, meta: {}, data: { id: row.id } };
    }
    if (path.endsWith("/duplicate"))
      return { success: true, meta: {}, data: { id: "new-copy" } };
    if (init?.method === "PATCH") {
      row.title = JSON.parse(init.body as string).title;
      return { success: true, meta: {} };
    }
    if (init?.method === "DELETE") {
      empty = true;
      return { success: true, meta: {} };
    }
    if (init?.method === "PUT") {
      if (failSave) throw new Error("연결 실패");
      row = { ...row, ...JSON.parse(init.body as string) };
      return { success: true, meta: {} };
    }
    return { success: true, meta: {}, data: row };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("UI contract improvements", () => {
  it("redirects an expired editor logout session to login", async () => {
    const normal = api.getMockImplementation()!;
    api.mockImplementation((path, init) => {
      if (path === "/api/auth/logout")
        return Promise.reject(
          new ApiRequestError(401, {
            success: false,
            meta: {},
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다.",
            field: null,
          }),
        );
      return normal(path, init);
    });
    mount("/resumes/selected-resume/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "Login" });
    expect(screen.queryByLabelText("이름")).toBeNull();
  });
  it("keeps the editor on a non-session logout failure and shows the server message", async () => {
    const normal = api.getMockImplementation()!;
    api.mockImplementation((path, init) =>
      path === "/api/auth/logout"
        ? Promise.reject(new Error("세션 종료 서버 오류"))
        : normal(path, init),
    );
    mount("/resumes/selected-resume/edit");
    await screen.findByLabelText("이름");
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByText("세션 종료 서버 오류");
    expect(screen.getByLabelText("이름")).toHaveValue("지우");
    expect(screen.queryByRole("heading", { name: "Login" })).toBeNull();
  });
  it("shows only unmet completeness criteria without saving", async () => {
    mount("/resumes/selected-resume/edit");
    fireEvent.click(await screen.findByRole("button", { name: /완성도/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/필수값 모두 충족/)).toBeNull();
    expect(within(dialog).queryByText(/자기소개 본문/)).toBeNull();
    expect(within(dialog).getByText(/사진.*10/)).toBeVisible();
    expect(api.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
  });
  it("distinguishes a committed rename from a failed title refresh and preserves the draft", async () => {
    const normal = api.getMockImplementation()!;
    let renamed = false;
    api.mockImplementation((path, init) => {
      if (init?.method === "PATCH") renamed = true;
      if (renamed && path === "/api/resumes/selected-resume" && !init?.method)
        return Promise.reject(new Error("조회 연결 실패"));
      return normal(path, init);
    });
    mount("/resumes/selected-resume/edit");
    fireEvent.click(await screen.findByRole("button", { name: row.title }));
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "변경 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await screen.findByText(/이름은 변경되었지만.*조회/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "변경 제목" })).toBeVisible();
    expect(screen.getByLabelText("본문")).toHaveValue("원본 본문");
    expect(
      api.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(1);
  });
  it("associates the server title error with the editor title input and keeps its saved title", async () => {
    const normal = api.getMockImplementation()!;
    api.mockImplementation((path, init) =>
      init?.method === "PATCH"
        ? Promise.reject(
            new ApiRequestError(400, {
              success: false,
              meta: {},
              code: "INVALID_INPUT",
              message: "서버 제목 검증 오류",
              field: "title",
            }),
          )
        : normal(path, init),
    );
    mount("/resumes/selected-resume/edit");
    fireEvent.click(await screen.findByRole("button", { name: row.title }));
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "거부 제목" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "서버 제목 검증 오류",
      ),
    );
    expect(within(dialog).getByLabelText("제목")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("button", { name: original.title })).toBeVisible();
  });
  it("uses saved basics fields rather than the resume title for the PDF document title", async () => {
    mount("/print/selected-resume");
    await waitFor(() => expect(document.title).toBe("지우_개발자_이력서"));
  });
  it("disables creation while the API-backed library is loading", () => {
    api.mockImplementation(() => new Promise(() => undefined));
    mount();
    expect(screen.getByRole("button", { name: /새 이력서/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
    expect(
      document.querySelectorAll(".resume-skeleton").length,
    ).toBeGreaterThan(0);
  });
  it("collapses a section without mutating its saved content", async () => {
    mount("/resumes/selected-resume/edit");
    const toggle = await screen.findByRole("button", { name: "자기소개 접기" });
    fireEvent.click(toggle);
    expect(screen.getByLabelText("한 줄 소개")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "자기소개 펼치기" }));
    expect(screen.getByLabelText("한 줄 소개")).toBeInTheDocument();
    expect(api.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
  });
  it("leaves the protected editor on an expired save session", async () => {
    const normal = api.getMockImplementation()!;
    api.mockImplementation((path, init) => {
      if (init?.method === "PUT")
        return Promise.reject(
          new ApiRequestError(401, {
            success: false,
            meta: {},
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다.",
            field: null,
          }),
        );
      return normal(path, init);
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mount("/resumes/selected-resume/edit");
    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "변경" },
    });
    fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
    await screen.findByRole("heading", { name: "Login" });
    expect(screen.queryByLabelText("이름")).toBeNull();
  });
  it("only expands one item across sections", async () => {
    row.content.push({
      type: "education",
      hidden: false,
      items: [
        {
          id: "school",
          school: "첫 학교",
          major: "",
          degree: "",
          start: "",
          end: "",
          current: false,
        },
      ],
    });
    const experience = row.content.find(
      (section) => section.type === "experience",
    )!;
    if (experience.type === "experience")
      experience.items[0].company = "첫 회사";
    mount("/resumes/selected-resume/edit");
    fireEvent.click(await screen.findByRole("button", { name: "첫 회사" }));
    expect(screen.getByLabelText("회사명")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "첫 학교" }));
    expect(screen.getByLabelText("학교명")).toBeVisible();
    expect(screen.queryByLabelText("회사명")).toBeNull();
  });
  it("confirms the server title after editor rename without replacing unsaved content", async () => {
    mount("/resumes/selected-resume/edit");
    fireEvent.click(await screen.findByRole("button", { name: row.title }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("제목"), {
      target: { value: "새 제목" },
    });
    const before = api.mock.calls.filter(
      ([path]) => path === "/api/resumes/selected-resume",
    ).length;
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await screen.findByRole("button", { name: "새 제목" });
    expect(
      api.mock.calls.filter(([path]) => path === "/api/resumes/selected-resume")
        .length,
    ).toBeGreaterThan(before + 1);
  });
  it("does not signal print readiness when the linked photo fails", async () => {
    row.content[0] = {
      ...row.content[0],
      data: {
        name: "지우",
        jobTitle: "개발자",
        email: "jiwoo@resume.dev",
        phone: "",
        links: [],
        photoId: "unavailable-photo",
      },
    } as Resume["content"][number];
    const ready = vi.fn();
    const failure = vi.fn();
    const { container } = render(
      <ResumeRenderer resume={row} onReady={ready} onError={failure} />,
    );
    await waitFor(() =>
      expect(container.querySelector(".resume-measure img")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.error(container.querySelector(".resume-measure img")!);
    });
    expect(ready).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalledWith(expect.stringContaining("사진"));
    expect(screen.getByRole("alert")).toHaveTextContent("사진");
  });
});

describe("resume list and support dialogs", () => {
  it("authenticated entry and selected card reach the real editor", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("link", { name: "지우 이력서 편집" }),
    );
    expect(await screen.findByLabelText("희망 직무")).toHaveProperty(
      "value",
      "개발자",
    );
    expect(api).toHaveBeenCalledWith("/api/resumes/selected-resume");
  });
  it("create modal validates title then uses returned ID and server data", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("제목"), {
      target: { value: "  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "생성" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("제목");
    fireEvent.change(within(dialog).getByLabelText("제목"), {
      target: { value: "새 지원서" },
    });
    fireEvent.change(within(dialog).getByLabelText("템플릿"), {
      target: { value: "modern" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "생성" }));
    expect(await screen.findByLabelText("희망 직무")).toBeTruthy();
    expect(
      api.mock.calls.some(([path]) => path === "/api/resumes/created-resume"),
    ).toBe(true);
  });
  it("rename persists trimmed title and refreshes cards", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "지우 이력서 메뉴" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "이름 변경" }));
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: " 새 이름 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(
      await screen.findByRole("link", { name: "새 이름 편집" }),
    ).toBeTruthy();
    expect(row.title).toBe("새 이름");
  });
  it("deletion cancel preserves card and never calls DELETE; confirmation removes it", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "지우 이력서 메뉴" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(api.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(
      false,
    );
    expect(screen.getByRole("link", { name: "지우 이력서 편집" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "지우 이력서 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "지우 이력서 편집" }),
      ).toBeNull(),
    );
  });
  it("duplicate uses selected card ID and refreshes the server list", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "지우 이력서 메뉴" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "복제" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/api/resumes/selected-resume/duplicate",
        { method: "POST" },
      ),
    );
  });
  it("empty list still permits creation", async () => {
    empty = true;
    mount();
    expect(await screen.findByText(/아직 이력서가 없습니다/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ 새 이력서" })).toBeTruthy();
  });
  it("failed request offers retry and never substitutes fixture data", async () => {
    api.mockRejectedValue(new Error("offline"));
    mount();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "지우 이력서 편집" })).toBeNull();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });
  it("expired session reaches login without protected data", async () => {
    api.mockRejectedValue(
      new ApiRequestError(401, {
        success: false,
        meta: {},
        code: "UNAUTHORIZED",
        message: "로그인 필요",
        field: null,
      }),
    );
    mount();
    expect(await screen.findByRole("heading", { name: "Login" })).toBeTruthy();
  });
  it("logout uses the shared contract and goes to login", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(await screen.findByRole("heading", { name: "Login" })).toBeTruthy();
  });
});

describe("editor draft interactions", () => {
  it("immediate preview and invalid email warning do not block synchronized navigation", async () => {
    mount("/resumes/selected-resume/edit");
    fireEvent.change(await screen.findByLabelText("이메일"), {
      target: { value: "abc@" },
    });
    expect(screen.getByText("이메일 형식을 확인해 주세요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(
      await screen.findByRole("heading", { name: "내 이력서" }),
    ).toBeTruthy();
    expect(row.content[0].type === "basics" && row.content[0].data.email).toBe(
      "abc@",
    );
  });
  it("failed save keeps editor, exposes retry and prevents navigation", async () => {
    mount("/resumes/selected-resume/edit");
    fireEvent.change(await screen.findByLabelText("희망 직무"), {
      target: { value: "새 직무" },
    });
    failSave = true;
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(
      await screen.findByRole("button", { name: "저장 실패·다시 시도" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
    failSave = false;
    fireEvent.click(
      screen.getByRole("button", { name: "저장 실패·다시 시도" }),
    );
    expect(await screen.findByRole("button", { name: "저장됨" })).toBeTruthy();
    expect(
      row.content[0].type === "basics" && row.content[0].data.jobTitle,
    ).toBe("새 직무");
  });
  it("missing PDF values open modal and return focus without iframe", async () => {
    mount("/resumes/selected-resume/edit");
    fireEvent.change(await screen.findByLabelText("희망 직무"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "기본정보 · 희망 직무" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("희망 직무")),
    );
    expect(screen.queryByTitle("이력서 PDF 인쇄")).toBeNull();
  });
  it("PDF saves latest draft first; failed save never creates print iframe", async () => {
    mount("/resumes/selected-resume/edit");
    fireEvent.change(await screen.findByLabelText("희망 직무"), {
      target: { value: "최신 직무" },
    });
    failSave = true;
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(screen.queryByTitle("이력서 PDF 인쇄")).toBeNull();
    failSave = false;
    fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
    expect(await screen.findByTitle("이력서 PDF 인쇄")).toHaveProperty(
      "src",
      expect.stringContaining("/print/selected-resume"),
    );
    expect(
      row.content[0].type === "basics" && row.content[0].data.jobTitle,
    ).toBe("최신 직무");
  });
  it("style changes preserve content, expose six colors and map 9/10/11pt", async () => {
    mount("/resumes/selected-resume/edit");
    await screen.findByLabelText("희망 직무");
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    fireEvent.change(screen.getByLabelText("템플릿"), {
      target: { value: "modern" },
    });
    fireEvent.change(screen.getByLabelText("글자 크기"), {
      target: { value: "large" },
    });
    fireEvent.click(screen.getByRole("button", { name: "#2563EB" }));
    fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
    await screen.findByRole("button", { name: "저장됨" });
    expect(row.content).toEqual(original.content);
    expect(row.style).toEqual({
      color: "#2563EB",
      size: "large",
      font: "pretendard",
    });
    expect(row.template).toBe("modern");
  });
  it("basics is fixed, hidden sections retain inputs and section deletion needs confirmation", async () => {
    mount("/resumes/selected-resume/edit");
    await screen.findByLabelText("희망 직무");
    const basics = screen
      .getByRole("heading", { name: "기본정보" })
      .closest("article")!;
    expect(within(basics).queryByRole("button", { name: "숨김" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "표시" }));
    fireEvent.click(screen.getByRole("button", { name: "(제목 없음)" }));
    fireEvent.click(screen.getByLabelText("현재 재직·재학 중"));
    expect(screen.getByLabelText("종료일")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("종료일")).toHaveProperty("value", "2021.01");
    fireEvent.click(screen.getByLabelText("현재 재직·재학 중"));
    expect(screen.getByLabelText("종료일")).toHaveProperty("value", "2021.01");
    const section = screen
      .getByRole("heading", { name: "경력 (1)" })
      .closest("article")!;
    fireEvent.click(within(section).getByRole("button", { name: "섹션 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByLabelText("회사명")).toBeTruthy();
  });
  it("beforeunload warns only for unsaved revisions and mobile tabs are real controls", async () => {
    mount("/resumes/selected-resume/edit");
    await screen.findByLabelText("희망 직무");
    let event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "변경" },
    });
    event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "미리보기" }));
    expect(
      document.querySelector(".resume-editor")?.getAttribute("data-tab"),
    ).toBe("preview");
  });
});

describe("shared measured renderer and print page", () => {
  it("keeps whole items together and splits oversized text without losing characters", () => {
    const blocks = [
      { key: "first", section: "summary", lines: ["one"] },
      {
        key: "second",
        section: "experience",
        lines: ["two three four five six seven eight"],
      },
    ];
    const pages = paginateResumeBlocks(
      blocks,
      (block) => block.lines.join("").length,
      10,
    );
    expect(pages.length).toBeGreaterThan(1);
    expect(
      pages
        .flat()
        .flatMap((block) => block.lines)
        .join(""),
    ).toBe(blocks.flatMap((block) => block.lines).join(""));
  });
  it("omits hidden content for thumbnail and preview and assigns modern columns", async () => {
    const { container } = render(
      <ResumeRenderer resume={{ ...row, template: "modern" }} />,
    );
    await waitFor(() =>
      expect(
        container.querySelector(
          ".resume-paper .column-0 [data-section=basics]",
        ),
      ).toBeTruthy(),
    );
    expect(
      container.querySelector(".resume-paper .column-1 [data-section=summary]"),
    ).toBeTruthy();
    expect(
      container.querySelector(".resume-paper [data-section=experience]"),
    ).toBeNull();
  });
  it("print reads server content and sets document title without editor controls", async () => {
    render(
      <MemoryRouter initialEntries={["/print/selected-resume"]}>
        <Routes>
          <Route path="/print/:id" element={<PrintPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.title).toBe("지우_개발자_이력서"));
    expect(api).toHaveBeenCalledWith("/api/resumes/selected-resume");
    expect(screen.queryByRole("button", { name: "PDF 내보내기" })).toBeNull();
  });
});
