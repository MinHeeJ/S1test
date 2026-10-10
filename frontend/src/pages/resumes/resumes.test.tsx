import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { ResumeListPage } from "./ResumeListPage";
import { ResumeEditorPage } from "./ResumeEditorPage";
import { ResumePrintPage } from "./ResumePrintPage";
import { ResumeRenderer, paginate } from "./ResumeRenderer";
import { SectionFields } from "./SectionFields";

it("photo completion preserves basic fields edited while uploading", () => {
  const initial = resumeFixture().content[0];
  if (initial.type !== "basics") throw new Error("basics required");
  let finish!: (photoId: string | null) => void;
  const change = vi.fn();
  const props = {
    change,
    expanded: undefined,
    setExpanded: vi.fn(),
    photoControl: (_id: string | null, callback: typeof finish) => {
      finish = callback;
      return null;
    },
  };
  const view = render(<SectionFields {...props} section={initial} />);
  const oldCallback = finish;
  view.rerender(
    <SectionFields
      {...props}
      section={{ ...initial, data: { ...initial.data, name: "최신 이름" } }}
    />,
  );
  oldCallback("uploaded-photo");
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        name: "최신 이름",
        photoId: "uploaded-photo",
      }),
    }),
  );
});
import { completeness, requiredFields, scoreColor, warning } from "./content";
import {
  clearResumeDraft,
  restoreResumeDraft,
  retainResumeDraft,
  setResumeSessionIdentity,
} from "./ResumeSession";

export function resumeFixture(): Resume {
  return {
    id: "fixture-resume",
    title: "테스트 이력서",
    template: "classic",
    style: { color: "#123abc", font: "pretendard", size: "medium" },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "테스트 이름",
          jobTitle: "개발자",
          email: "test@example.org",
          phone: "",
          links: [],
          photoId: null,
        },
      },
      {
        type: "summary",
        hidden: false,
        data: { headline: "소개", body: "설명" },
      },
      {
        type: "experience",
        hidden: true,
        items: [
          {
            id: "item",
            company: "",
            position: "",
            start: "bad",
            end: "2020.01",
            current: false,
            description: "숨긴 내용",
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: { tags: ["Java", "SQL", "React"] },
      },
    ],
    updated_at: "2025-01-01T00:00:00Z",
  };
}
let stored: Resume;
let calls: { path: string; method: string; body?: unknown }[];
let failSave = false;
let failGet = false;
function response(data?: unknown, meta: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      meta,
      ...(data === undefined ? {} : { data }),
    }),
  );
}
beforeEach(() => {
  stored = resumeFixture();
  calls = [];
  failSave = false;
  failGet = false;
  document.cookie = "XSRF-TOKEN=test-token; path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit = {}) => {
      const method = options.method ?? "GET";
      const body = options.body ? JSON.parse(String(options.body)) : undefined;
      calls.push({ path, method, body });
      if (path === "/api/auth/me")
        return response({ nickname: "테스트 사용자" });
      if (path === "/api/auth/logout" || path === "/api/health")
        return response();
      if (path.startsWith("/api/resumes?"))
        return response(stored ? [stored] : [], {
          page: 0,
          size: 20,
          totalElements: stored ? 1 : 0,
          totalPages: stored ? 1 : 0,
        });
      if (path === "/api/resumes" && method === "POST")
        return response({ id: stored.id });
      if (method === "GET" && failGet)
        return new Response(
          JSON.stringify({
            success: false,
            meta: {},
            code: "404",
            message: "요청한 자료를 찾을 수 없습니다.",
            field: null,
          }),
          { status: 404 },
        );
      if (method === "PUT") {
        if (failSave) throw new Error("저장 오류");
        stored = { ...stored, ...body };
        return response();
      }
      if (method === "PATCH") {
        stored = { ...stored, title: body.title };
        return response();
      }
      if (method === "DELETE") {
        stored = undefined as unknown as Resume;
        return response();
      }
      if (path.endsWith("/duplicate")) return response({ id: "copy-id" });
      return response(stored);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  clearResumeDraft();
});
function mount(path = "/resumes") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resumes" element={<ResumeListPage />} />
        <Route path="/resumes/:id/edit" element={<ResumeEditorPage />} />
        <Route path="/print/:id" element={<ResumePrintPage />} />
        <Route path="/login" element={<h1>로그인</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

it("list request failure exposes a retry that queries the API again", async () => {
  const fetcher = fetch;
  let failed = false;
  vi.stubGlobal("fetch", async (path: string, options?: RequestInit) => {
    if (path.startsWith("/api/resumes?") && !failed) {
      failed = true;
      throw new Error("연결 실패");
    }
    return fetcher(path, options);
  });
  mount();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(
    await screen.findByRole("link", { name: "테스트 이력서 편집" }),
  ).toBeDefined();
});
it("authorized list shows server card and its selected entry reaches the real editor", async () => {
  mount();
  const link = await screen.findByRole("link", { name: "테스트 이력서 편집" });
  fireEvent.click(link);
  expect(await screen.findByLabelText("이름")).toBeDefined();
  expect(
    calls.some((call) => call.path === "/api/resumes/fixture-resume"),
  ).toBe(true);
});
it("create modal cancel performs no POST; successful create navigates to its returned ID", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
  expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe(
    "새 이력서",
  );
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(calls.some((call) => call.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
  fireEvent.click(screen.getByRole("button", { name: "생성" }));
  expect(await screen.findByLabelText("이름")).toBeDefined();
});
it("card title opens the selected resume editor", async () => {
  mount();
  const title = await screen.findByRole("heading", { name: "테스트 이력서" });
  fireEvent.click(within(title).getByRole("link"));
  expect(await screen.findByLabelText("이름")).toBeDefined();
  expect(
    calls.some((call) => call.path === "/api/resumes/fixture-resume"),
  ).toBe(true);
});

it.each(["title", "template"])(
  "create associates server %s errors with only that field",
  async (field) => {
    const fetcher = fetch;
    vi.stubGlobal("fetch", async (path: string, options?: RequestInit) => {
      if (path === "/api/resumes" && options?.method === "POST") {
        return new Response(
          JSON.stringify({
            success: false,
            meta: {},
            code: "VALIDATION_ERROR",
            message: "입력값을 확인하세요.",
            field,
          }),
          { status: 400 },
        );
      }
      return fetcher(path, options);
    });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByRole("alert");
    const invalid = within(dialog).getByLabelText(
      field === "title" ? "제목" : "템플릿",
    );
    const valid = within(dialog).getByLabelText(
      field === "title" ? "템플릿" : "제목",
    );
    expect(invalid.getAttribute("aria-invalid")).toBe("true");
    expect(valid.getAttribute("aria-invalid")).not.toBe("true");
    expect(
      document.getElementById(invalid.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("입력값을 확인하세요.");
    expect(screen.queryByLabelText("이름")).toBeNull();
  },
);

it("editor title rejection retains input and connects the server field error", async () => {
  const fetcher = fetch;
  vi.stubGlobal("fetch", async (path: string, options?: RequestInit) => {
    if (options?.method === "PATCH") {
      return new Response(
        JSON.stringify({
          success: false,
          meta: {},
          code: "VALIDATION_ERROR",
          message: "제목을 확인하세요.",
          field: "title",
        }),
        { status: 400 },
      );
    }
    return fetcher(path, options);
  });
  mount("/resumes/fixture-resume/edit");
  fireEvent.click(await screen.findByRole("button", { name: "테스트 이력서" }));
  fireEvent.change(screen.getByLabelText("이력서 제목"), {
    target: { value: "거부된 제목" },
  });
  fireEvent.keyDown(screen.getByLabelText("이력서 제목"), { key: "Enter" });
  const input = screen.getByLabelText("이력서 제목") as HTMLInputElement;
  await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
  expect(
    document.getElementById(input.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("제목을 확인하세요.");
  expect(input.value).toBe("거부된 제목");
  expect(stored.title).toBe("테스트 이력서");
});

it("section collapse preserves content; expanding scrolls without saving", async () => {
  const scroll = vi.fn();
  mount("/resumes/fixture-resume/edit");
  await screen.findByLabelText("한 줄 소개");
  await waitFor(() =>
    expect(
      document.querySelector(
        '.resumes-preview .resume-paper [data-section="summary"]',
      ),
    ).not.toBeNull(),
  );
  const preview = document.querySelector<HTMLElement>(
    '.resumes-preview .resume-paper [data-section="summary"]',
  )!;
  preview.scrollIntoView = scroll;
  const toggle = within(
    screen.getByLabelText("한 줄 소개").closest("section")!,
  ).getByRole("button", { name: "자기소개" });
  fireEvent.click(toggle);
  expect(screen.queryByRole("textbox", { name: "한 줄 소개" })).toBeNull();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect((screen.getByLabelText("한 줄 소개") as HTMLInputElement).value).toBe(
    "소개",
  );
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(calls.some((call) => call.method === "PUT")).toBe(false);
});

it("collapsing a section preserves its unfinished tag input", async () => {
  mount("/resumes/fixture-resume/edit");
  fireEvent.change(await screen.findByLabelText("기술 태그"), {
    target: { value: "입력 중인 태그" },
  });
  const toggle = within(
    screen.getByLabelText("기술 태그").closest("section")!,
  ).getByRole("button", { name: "기술스택" });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect((screen.getByLabelText("기술 태그") as HTMLInputElement).value).toBe(
    "입력 중인 태그",
  );
  expect(calls.some((call) => call.method === "PUT")).toBe(false);
});

it("PDF missing field reopens a collapsed section before focusing", async () => {
  const basics = stored.content[0];
  if (basics.type === "basics") basics.data.jobTitle = "";
  mount("/resumes/fixture-resume/edit");
  const name = await screen.findByLabelText("이름");
  fireEvent.click(
    within(name.closest("section")!).getByRole("button", { name: "기본정보" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  fireEvent.click(screen.getByRole("button", { name: "기본정보 · 희망 직무" }));
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("basics-jobTitle"),
  );
  expect(document.querySelector("iframe")).toBeNull();
});

it("rename is title-only and refreshes the card after successful PATCH", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "테스트 이력서 메뉴" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "변경 제목" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(
    await screen.findByRole("button", { name: "변경 제목 메뉴" }),
  ).toBeDefined();
  expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
    title: "변경 제목",
  });
});
it("blank rename stays in dialog and leaves the stored title intact", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "테스트 이력서 메뉴" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
  fireEvent.change(screen.getByLabelText("제목"), { target: { value: "  " } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(screen.getByRole("dialog")).toBeDefined();
  expect(calls.some((call) => call.method === "PATCH")).toBe(false);
  expect(stored.title).toBe("테스트 이력서");
});
it("delete cancel leaves card and makes no DELETE; confirmation removes only after success", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "테스트 이력서 메뉴" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "테스트 이력서 메뉴" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "테스트 이력서 메뉴" }),
    ).toBeNull(),
  );
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
});
it("duplicate calls the selected ID once then re-queries page zero", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "테스트 이력서 메뉴" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  await waitFor(() =>
    expect(
      calls.filter((call) => call.path.includes("/api/resumes?")),
    ).toHaveLength(2),
  );
  expect(
    calls.filter(
      (call) => call.path === "/api/resumes/fixture-resume/duplicate",
    ),
  ).toHaveLength(1);
});
it("missing PDF required field opens focusable missing modal without printing", async () => {
  const basics = stored.content[0];
  if (basics.type === "basics") basics.data.jobTitle = "";
  mount("/resumes/fixture-resume/edit");
  fireEvent.click(await screen.findByRole("button", { name: "PDF 내보내기" }));
  fireEvent.click(screen.getByRole("button", { name: "기본정보 · 희망 직무" }));
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("basics-jobTitle"),
  );
  expect(document.querySelector("iframe")).toBeNull();
});
it("changing partial email is saveable and navigation flushes PUT before returning to list", async () => {
  mount("/resumes/fixture-resume/edit");
  fireEvent.change(await screen.findByLabelText("이메일"), {
    target: { value: "abc@" },
  });
  expect(screen.getByText("이메일 형식을 확인해 주세요.")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeDefined();
  const putIndex = calls.findIndex((call) => call.method === "PUT");
  expect(putIndex).toBeGreaterThan(-1);
  expect(
    calls.findIndex((call) => call.path.startsWith("/api/resumes?")),
  ).toBeGreaterThan(putIndex);
});
it("failed flush stays in editor with draft and retry persists the unchanged local input", async () => {
  mount("/resumes/fixture-resume/edit");
  fireEvent.change(await screen.findByLabelText("이름"), {
    target: { value: "최신 이름" },
  });
  failSave = true;
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  expect(
    await screen.findByRole("button", { name: "저장 실패·다시 시도" }),
  ).toBeDefined();
  expect((screen.getByLabelText("이름") as HTMLInputElement).value).toBe(
    "최신 이름",
  );
  failSave = false;
  fireEvent.click(screen.getByRole("button", { name: "저장 실패·다시 시도" }));
  await waitFor(() =>
    expect(
      stored.content[0].type === "basics" && stored.content[0].data.name,
    ).toBe("최신 이름"),
  );
});
it("section delete requires confirmation, preserves basics, and offers removed type again", async () => {
  mount("/resumes/fixture-resume/edit");
  await screen.findByLabelText("이름");
  const summary = screen.getByLabelText("한 줄 소개").closest("section")!;
  fireEvent.click(within(summary).getByRole("button", { name: "섹션 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByLabelText("한 줄 소개")).toBeDefined();
  fireEvent.click(within(summary).getByRole("button", { name: "섹션 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  expect(screen.queryByLabelText("한 줄 소개")).toBeNull();
  expect(screen.getByRole("option", { name: "자기소개" })).toBeDefined();
  const basics = screen.getByLabelText("이름").closest("section")!;
  expect(
    within(basics).queryByRole("button", { name: "섹션 삭제" }),
  ).toBeNull();
});
it("title Enter sends PATCH while Escape cancels locally and blur does not confirm", async () => {
  mount("/resumes/fixture-resume/edit");
  fireEvent.click(await screen.findByRole("button", { name: "테스트 이력서" }));
  fireEvent.change(screen.getByLabelText("이력서 제목"), {
    target: { value: "취소 제목" },
  });
  fireEvent.blur(screen.getByLabelText("이력서 제목"));
  expect(calls.some((call) => call.method === "PATCH")).toBe(false);
  fireEvent.keyDown(screen.getByLabelText("이력서 제목"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "테스트 이력서" }));
  fireEvent.change(screen.getByLabelText("이력서 제목"), {
    target: { value: "새 제목" },
  });
  fireEvent.keyDown(screen.getByLabelText("이력서 제목"), { key: "Enter" });
  expect(await screen.findByRole("button", { name: "새 제목" })).toBeDefined();
});
it("style changes preserve content and arbitrary valid stored hex", async () => {
  mount("/resumes/fixture-resume/edit");
  fireEvent.click(await screen.findByRole("button", { name: "템플릿·스타일" }));
  fireEvent.change(screen.getByLabelText("템플릿"), {
    target: { value: "modern" },
  });
  fireEvent.change(screen.getByLabelText("글자 크기"), {
    target: { value: "large" },
  });
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  await screen.findByRole("heading", { name: "내 이력서" });
  expect(stored.style.color).toBe("#123abc");
  expect(stored.style.size).toBe("large");
  expect(stored.content).toEqual(resumeFixture().content);
});
it("404 detail exposes no form or renderer rather than synthesizing an empty resume", async () => {
  failGet = true;
  mount("/resumes/fixture-resume/edit");
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.queryByLabelText("이름")).toBeNull();
});
it("server-source print GETs first and prints only after renderer readiness", async () => {
  vi.stubGlobal("print", vi.fn());
  mount("/print/fixture-resume");
  await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  expect(
    calls.some((call) => call.path === "/api/resumes/fixture-resume"),
  ).toBe(true);
  expect(document.title).toBe("테스트 이름_개발자_이력서");
});
it("failed print GET never opens print", async () => {
  failGet = true;
  vi.stubGlobal("print", vi.fn());
  mount("/print/fixture-resume");
  await screen.findByRole("alert");
  expect(window.print).not.toHaveBeenCalled();
});
it("employment fields explain date format and disable the end date while current", () => {
  const section = resumeFixture().content.find(
    (entry) => entry.type === "experience",
  );
  if (section?.type !== "experience") throw new Error("experience required");
  section.items[0].current = true;
  render(
    <SectionFields
      section={section}
      change={vi.fn()}
      expanded="item"
      setExpanded={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("재직중")).toBeDefined();
  expect(screen.getByLabelText("종료일").hasAttribute("disabled")).toBe(true);
  expect(screen.getByLabelText("시작일").getAttribute("placeholder")).toBe(
    "YYYY.MM",
  );
});
it("current employment without dates still renders the current status", async () => {
  const resume = resumeFixture();
  const experience = resume.content.find(
    (section) => section.type === "experience",
  );
  if (experience?.type !== "experience") throw new Error("experience required");
  experience.hidden = false;
  experience.items[0] = {
    ...experience.items[0],
    company: "재직 회사",
    start: "",
    end: "",
    current: true,
  };
  const { container } = render(<ResumeRenderer {...resume} />);
  await waitFor(() =>
    expect(container.querySelector(".resume-paper")?.textContent).toContain(
      "현재",
    ),
  );
});
it("renderer shares A4 output and excludes hidden sections without changing source data", async () => {
  const resume = resumeFixture();
  const { container } = render(<ResumeRenderer {...resume} />);
  await waitFor(() =>
    expect(container.querySelector(".resume-paper")?.textContent).toContain(
      "테스트 이름",
    ),
  );
  expect(container.textContent).not.toContain("숨긴 내용");
  expect(resume.content[2].hidden).toBe(true);
});

describe("local completeness and pagination", () => {
  it("hidden empty items do not block required fields or grant existence points", () => {
    expect(requiredFields(resumeFixture().content)).toEqual([]);
    expect(completeness(resumeFixture().content).score).toBe(70);
  });
  it.each([
    [49, "var(--danger)"],
    [50, "var(--warn)"],
    [79, "var(--warn)"],
    [80, "var(--accent)"],
  ])("score boundary %s has correct color", (score, color) =>
    expect(scoreColor(Number(score))).toBe(color),
  );
  it("date and reverse range warnings never mutate storage values", () => {
    expect(warning("start", "bad", {})).toBeDefined();
    expect(warning("end", "2020.01", { start: "2025.01" })).toBeDefined();
    expect(warning("end", "bad", { current: true })).toBeUndefined();
  });
  it("packs whole blocks and splits only oversize blocks without losing height", () => {
    expect(
      paginate([80, 40], 100).map((page) => page.map((part) => part.index)),
    ).toEqual([[0], [1]]);
    const parts = paginate([250], 100).flat();
    expect(parts.map((part) => part.offset)).toEqual([0, 100, 200]);
    expect(parts.reduce((sum, part) => sum + part.height, 0)).toBe(250);
  });
  it("draft recovery is memory-only and constrained to original identity and selected resume", () => {
    setResumeSessionIdentity("original-user");
    retainResumeDraft(resumeFixture());
    expect(restoreResumeDraft("fixture-resume")).toEqual(resumeFixture());
    expect(restoreResumeDraft("other-resume")).toBeUndefined();
    setResumeSessionIdentity("other-user");
    expect(restoreResumeDraft("fixture-resume")).toBeUndefined();
  });
});
