import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../app/router";
import { useSessionStore } from "../../app/sessionStore";
import { useToastStore } from "../../shared/Toast";
import { ApiRequestError } from "../../shared/apiClient";
import { resumeScreens } from "./screens";
import { resumesApi } from "./resumesApi";
import { ResumeRenderer } from "./ResumeRenderer";
import { testResume } from "./testResume";
import PrintPage, { waitForImages } from "./SC-PRINT";

vi.mock("./resumesApi", () => ({
  resumesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    uploadPhoto: vi.fn(),
  },
}));
const api = vi.mocked(resumesApi);
beforeEach(() => {
  useSessionStore.setState({
    user: { nickname: "지우" },
    status: "authenticated",
    error: null,
  });
  useToastStore.getState().clear();
  api.list.mockResolvedValue([testResume()]);
  api.get.mockResolvedValue(testResume());
  api.save.mockResolvedValue(undefined);
  api.rename.mockResolvedValue(undefined);
  api.delete.mockResolvedValue(undefined);
  api.duplicate.mockResolvedValue({ id: "28" });
  api.create.mockResolvedValue({ id: "28" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function open(path = "/") {
  const router = createMemoryRouter(
    applicationRoutes([
      ...resumeScreens,
      { path: "/login", element: <h1>로그인</h1> },
    ]),
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
async function editor() {
  const router = open("/resumes/27/edit");
  await screen.findByLabelText("희망 직무");
  return router;
}
async function menu() {
  await screen.findByRole("link", { name: "지원용 편집" });
  fireEvent.click(screen.getByRole("button", { name: "지원용 메뉴" }));
}
it("authorized root reaches list, API-backed thumbnail and selected card reaches its editor", async () => {
  const router = open();
  await screen.findByRole("link", { name: "지원용 편집" });
  expect(router.state.location.pathname).toBe("/resumes");
  expect(
    screen.getByRole("button", { name: "+ 새 이력서" }),
  ).toBeInTheDocument();
  expect(document.querySelector("time")).toHaveAttribute(
    "datetime",
    "2026-01-01T00:00:00Z",
  );
  fireEvent.click(screen.getByRole("link", { name: "지원용 편집" }));
  await screen.findByLabelText("희망 직무");
  expect(router.state.location.pathname).toBe("/resumes/27/edit");
  expect(api.get).toHaveBeenCalledWith("27");
});
it("anonymous cannot reach editor controls", async () => {
  useSessionStore.getState().clear();
  open("/resumes/27/edit");
  expect(
    await screen.findByRole("heading", { name: "로그인" }),
  ).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
it("list distinguishes loading, empty and failed reads", async () => {
  api.list.mockResolvedValue([]);
  open("/resumes");
  expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
  expect(
    await screen.findByText(
      "아직 이력서가 없습니다. 새 이력서를 만들어 보세요.",
    ),
  ).toBeInTheDocument();
});
it("failed list read shows error and no fictional card", async () => {
  api.list.mockRejectedValue(new Error("목록 오류"));
  open("/resumes");
  expect(await screen.findByRole("alert")).toHaveTextContent("목록 오류");
  expect(
    screen.queryByRole("link", { name: "지원용 편집" }),
  ).not.toBeInTheDocument();
});
it("delete cancellation sends no request and retains the real card", async () => {
  open("/resumes");
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
  );
  expect(api.delete).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "지원용 편집" })).toBeInTheDocument();
});
it("failed deletion keeps confirmation and retry context; success removes after refetch", async () => {
  api.delete.mockRejectedValueOnce(new Error("삭제 실패"));
  open("/resumes");
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  expect(
    await within(screen.getByRole("dialog")).findByRole("alert"),
  ).toHaveTextContent("삭제 실패");
  expect(screen.getByRole("link", { name: "지원용 편집" })).toBeInTheDocument();
  api.list.mockResolvedValue([]);
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("link", { name: "지원용 편집" }),
    ).not.toBeInTheDocument(),
  );
  expect(api.delete).toHaveBeenCalledWith("27");
});
it("rename submits selected ID and whitespace-only validation makes no command", async () => {
  open("/resumes");
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
  fireEvent.change(screen.getByLabelText("이력서 이름"), {
    target: { value: "\u2003" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(api.rename).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("제목");
  fireEvent.change(screen.getByLabelText("이력서 이름"), {
    target: { value: "원문 새 제목" },
  });
  api.list.mockResolvedValue([{ ...testResume(), title: "원문 새 제목" }]);
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(
    await screen.findByRole("link", { name: "원문 새 제목 편집" }),
  ).toBeInTheDocument();
  expect(api.rename).toHaveBeenCalledWith("27", "원문 새 제목");
});
it("duplicate is sent once and a successful command with failed refresh does not fabricate a card", async () => {
  open("/resumes");
  await menu();
  api.list.mockRejectedValue(new Error("재조회 실패"));
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("명령은 완료"),
  );
  expect(api.duplicate).toHaveBeenCalledTimes(1);
  expect(api.duplicate).toHaveBeenCalledWith("27");
  expect(screen.getByRole("link", { name: "지원용 편집" })).toBeInTheDocument();
});
it("successful deletion stays removed when refresh fails and retry only reads the list", async () => {
  const other = { ...testResume(), id: "28", title: "다른 이력서" };
  api.list.mockResolvedValue([testResume(), other]);
  open("/resumes");
  await menu();
  api.list.mockRejectedValueOnce(new Error("재조회 실패"));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("명령은 완료"),
  );
  expect(
    screen.queryByRole("link", { name: "지원용 편집" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "다른 이력서 편집" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  api.list.mockResolvedValue([other]);
  fireEvent.click(screen.getByRole("button", { name: "다시 조회" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(api.delete).toHaveBeenCalledTimes(1);
  expect(api.delete).toHaveBeenCalledWith("27");
});

it.each(["rename", "duplicate", "delete"] as const)(
  "%s 404 removes only the unavailable target and closes its stale action context",
  async (action) => {
    api.list.mockResolvedValue([
      testResume(),
      { ...testResume(), id: "28", title: "다른 이력서" },
    ]);
    api[action].mockRejectedValue(
      new ApiRequestError(404, {
        success: false,
        meta: {},
        code: "404",
        message: "이력서를 찾을 수 없습니다.",
        field: null,
      }),
    );
    open("/resumes");
    await menu();
    const label = { rename: "이름 변경", duplicate: "복제", delete: "삭제" }[
      action
    ];
    fireEvent.click(screen.getByRole("button", { name: label }));
    if (action === "rename") {
      fireEvent.change(screen.getByLabelText("이력서 이름"), {
        target: { value: "새 제목" },
      });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
    }
    if (action === "delete") {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "삭제 확인",
        }),
      );
    }
    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: "지원용 편집" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("이력서 이름")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "지원용 메뉴" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "다른 이력서 편집" }),
    ).toBeInTheDocument();
    expect(useToastStore.getState().message).toBe("이력서를 찾을 수 없습니다.");
    expect(api[action]).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
  },
);

it("editor rejects a response for a different ID instead of exposing or saving it", async () => {
  api.get.mockResolvedValue({
    ...testResume(),
    id: "28",
    title: "다른 대상 제목",
  });
  const router = open("/resumes/27/edit");
  await screen.findByRole("alert");
  expect(router.state.location.pathname).toBe("/resumes/27/edit");
  expect(screen.queryByLabelText("희망 직무")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "다른 대상 제목" }),
  ).not.toBeInTheDocument();
  expect(document.querySelector(".a4-page")).toBeNull();
  expect(api.save).not.toHaveBeenCalled();
});

it("creation blocks repeated clicks while pending then navigates using server ID", async () => {
  let release!: (value: { id: string }) => void;
  api.create.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const router = open("/resumes");
  await screen.findByRole("link", { name: "지원용 편집" });
  fireEvent.click(screen.getByRole("button", { name: "+ 새 이력서" }));
  fireEvent.click(screen.getByRole("button", { name: "생성" }));
  expect(screen.getByRole("button", { name: "생성" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "생성" }));
  expect(api.create).toHaveBeenCalledTimes(1);
  await act(async () => release({ id: "28" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/resumes/28/edit"),
  );
});
it("editor initial GET failure exposes inline error and never creates an empty document", async () => {
  api.get.mockRejectedValue(new Error("404"));
  open("/resumes/27/edit");
  expect(await screen.findByRole("alert")).toHaveTextContent("404");
  expect(api.create).not.toHaveBeenCalled();
});
it("local input changes preview immediately, then navigation flush commits snapshot before leaving", async () => {
  const router = await editor();
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "최신 이름" },
  });
  expect(document.querySelector(".a4-page h1")).toHaveTextContent("최신 이름");
  expect(screen.getByRole("button", { name: "변경됨" })).toBeInTheDocument();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/resumes"));
  expect(api.save).toHaveBeenCalledWith(
    "27",
    expect.objectContaining({ content: expect.any(Array) }),
  );
  expect(api.save.mock.calls[0][1].content[0]).toMatchObject({
    data: { name: "최신 이름" },
  });
});
it("failed flush keeps editor and dirty latest data; retry recovers without another GET", async () => {
  api.save.mockRejectedValueOnce(new Error("실패"));
  const router = await editor();
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "보존" },
  });
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  await screen.findByRole("button", { name: "저장 실패·다시 시도" });
  expect(router.state.location.pathname).toBe("/resumes/27/edit");
  expect(screen.getByLabelText("이름")).toHaveValue("보존");
  fireEvent.click(screen.getByRole("button", { name: "저장 실패·다시 시도" }));
  await screen.findByRole("button", { name: "저장됨" });
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(api.get).toHaveBeenCalledTimes(1);
});
it("PDF missing fields open exact location modal, focus the input and do not print", async () => {
  const r = testResume();
  if (r.content[0].type === "basics") r.content[0].data.jobTitle = "";
  api.get.mockResolvedValue(r);
  await editor();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  const dialog = screen.getByRole("dialog", { name: "빠진 항목" });
  expect(
    within(dialog).getByRole("button", { name: "기본정보 · 희망 직무" }),
  ).toBeInTheDocument();
  expect(document.querySelector("iframe")).toBeNull();
  expect(api.save).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "기본정보 · 희망 직무" }),
  );
  await waitFor(() => expect(screen.getByLabelText("희망 직무")).toHaveFocus());
});
it("PDF flush failure never creates print iframe", async () => {
  api.save.mockRejectedValue(new Error("실패"));
  await editor();
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "새 이름" },
  });
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await screen.findByRole("button", { name: "저장 실패·다시 시도" });
  expect(document.querySelector("iframe")).toBeNull();
});
it("style settings change local renderer and return to existing inputs without discarding", async () => {
  await editor();
  fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
  fireEvent.change(screen.getByLabelText("템플릿"), {
    target: { value: "modern" },
  });
  expect(document.querySelector(".resume-renderer.modern")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
  expect(screen.getByLabelText("희망 직무")).toHaveValue("개발자");
  expect(api.save).not.toHaveBeenCalled();
});
it("responsive mobile tabs retain the same editor data", async () => {
  await editor();
  fireEvent.click(screen.getByRole("button", { name: "미리보기" }));
  expect(document.querySelector(".editor-workspace")).toHaveAttribute(
    "data-tab",
    "preview",
  );
  fireEvent.click(screen.getByRole("button", { name: "입력" }));
  expect(document.querySelector(".editor-workspace")).toHaveAttribute(
    "data-tab",
    "input",
  );
  expect(screen.getByLabelText("희망 직무")).toHaveValue("개발자");
});
it("renderer filters hidden sections, renders bullet lines and classic/modern use one implementation", async () => {
  const r = testResume();
  r.content[2].hidden = true;
  const view = render(<ResumeRenderer {...r} />);
  await waitFor(() =>
    expect(document.querySelector(".a4-page h1")).toHaveTextContent("지우"),
  );
  expect(
    document.querySelector(".a4-page [data-section=experience]"),
  ).toBeNull();
  r.content[2].hidden = false;
  view.rerender(
    <ResumeRenderer {...r} template="modern" content={[...r.content]} />,
  );
  await waitFor(() =>
    expect(
      document.querySelector(".a4-page .document-bullet"),
    ).toHaveTextContent("• 항목"),
  );
  expect(
    document.querySelector(".a4-page .document-left h1"),
  ).toHaveTextContent("지우");
  expect(document.querySelectorAll(".a4-page h1")).toHaveLength(1);
});
it("top-level print cannot fetch private data or call window.print", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(<PrintPage />);
  expect(
    screen.getByText("인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다."),
  ).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  expect(print).not.toHaveBeenCalled();
});
it("framed print waits for font readiness, renders current server data and prints once", async () => {
  vi.stubGlobal("self", {});
  let release!: () => void;
  Object.defineProperty(document, "fonts", {
    value: {
      ready: new Promise<void>((resolve) => {
        release = resolve;
      }),
    },
    configurable: true,
  });
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const message = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(() => undefined);
  open("/print/27");
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("27"));
  expect(print).not.toHaveBeenCalled();
  await act(async () => release());
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(document.title).toBe("지우_개발자_이력서");
  expect(
    document.querySelector(".print-document .a4-page h1"),
  ).toHaveTextContent("지우");
  window.dispatchEvent(new Event("afterprint"));
  expect(message).toHaveBeenCalledWith(
    { type: "resume-print-finished" },
    window.location.origin,
  );
  Object.defineProperty(document, "fonts", {
    value: undefined,
    configurable: true,
  });
});
it("framed print GET failure aborts output and informs parent", async () => {
  vi.stubGlobal("self", {});
  api.get.mockRejectedValue(new Error("조회 실패"));
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const message = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(() => undefined);
  open("/print/27");
  expect(await screen.findByRole("alert")).toHaveTextContent("조회 실패");
  expect(print).not.toHaveBeenCalled();
  expect(message).toHaveBeenCalledWith(
    { type: "resume-print-error" },
    window.location.origin,
  );
});
it("image readiness rejects broken images and awaits not-yet-loaded images", async () => {
  const root = document.createElement("div");
  const image = document.createElement("img");
  root.append(image);
  Object.defineProperty(image, "complete", {
    value: false,
    configurable: true,
  });
  const ready = waitForImages(root);
  image.dispatchEvent(new Event("load"));
  await ready;
  Object.defineProperty(image, "complete", { value: true });
  await expect(waitForImages(root)).rejects.toThrow("사진");
});

it("list loading renders paper skeletons without flashing empty state", () => {
  api.list.mockReturnValue(new Promise(() => undefined));
  open("/resumes");
  expect(document.querySelector(".library-skeleton")).not.toBeNull();
  expect(
    screen.queryByText("아직 이력서가 없습니다. 새 이력서를 만들어 보세요."),
  ).toBeNull();
});
it("card menu closes with Escape from trigger and outside click", async () => {
  open("/resumes");
  await menu();
  fireEvent.keyDown(screen.getByRole("button", { name: "지원용 메뉴" }), {
    key: "Escape",
  });
  expect(screen.queryByRole("button", { name: "복제" })).toBeNull();
  await menu();
  fireEvent.pointerDown(screen.getByRole("heading", { name: "내 이력서" }));
  expect(screen.queryByRole("button", { name: "복제" })).toBeNull();
  expect(api.duplicate).not.toHaveBeenCalled();
});
it("editor failed read retries selected ID without creating or mutating", async () => {
  api.get.mockRejectedValueOnce(new Error("일시적 조회 실패"));
  open("/resumes/27/edit");
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "다시 조회" }));
  await screen.findByLabelText("희망 직무");
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.get).toHaveBeenLastCalledWith("27");
  expect(api.save).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});
