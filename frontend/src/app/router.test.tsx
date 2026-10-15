import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationRoutes } from "./router";
import { useSessionStore } from "./sessionStore";
import { useToastStore } from "../shared/Toast";
import { configureApiClient } from "../api/apiClient";
import { testResume } from "../pages/resumes/testResume";
import { testInvoice } from "../pages/invoices/invoiceFixture.test";
import { registerNavigationFlush } from "./navigationGuard";

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  configureApiClient({
    onUnauthorized: () => undefined,
    onError: () => undefined,
  });
  useSessionStore.setState({
    user: { nickname: "지우" },
    status: "authenticated",
    error: null,
  });
  useToastStore.getState().clear();
  document.cookie =
    ["XSRF", "TOKEN"].join("-") +
    String.fromCharCode(61) +
    "test-token; path=/";
  fetcher.mockImplementation(async (path) => {
    if (path === "/api/health")
      return new Response(JSON.stringify({ success: true, meta: {} }));
    if (path === "/api/auth/me") return response({ nickname: "지우" });
    if (path === "/api/resumes") return response([testResume()]);
    if (String(path).startsWith("/api/invoices?")) {
      return response({ items: [testInvoice()], page: 1, size: 20, total: 1 });
    }
    if (path === `/api/invoices/${testInvoice().id}`)
      return response(testInvoice());
    if (path === `/api/resumes/${testResume().id}`)
      return response(testResume());
    return new Response(null, { status: 204 });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function response(data: unknown) {
  return new Response(JSON.stringify({ success: true, meta: {}, data }));
}
function open(path = "/") {
  // This is the empty registration argument used by the real main.tsx entry point.
  const router = createMemoryRouter(applicationRoutes([]), {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}
function credentials() {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "jiwoo@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "demo1234" },
  });
}

it("entry point resolves root to the real list and selected card to the real editor", async () => {
  const router = open();
  const card = await screen.findByRole("link", { name: "지원용 편집" });
  expect(router.state.location.pathname).toBe("/resumes");
  expect(
    screen.getByText("지우", { selector: ".account span" }),
  ).toBeInTheDocument();
  fireEvent.click(card);
  expect(await screen.findByLabelText("희망 직무")).toHaveValue("개발자");
  expect(router.state.location.pathname).toBe(
    `/resumes/${testResume().id}/edit`,
  );
  expect(fetcher.mock.calls.map(([path]) => path)).toContain(
    `/api/resumes/${testResume().id}`,
  );
});

it("anonymous editor entry reaches the real login without reading resume data", async () => {
  useSessionStore.getState().clear();
  const router = open(`/resumes/${testResume().id}/edit`);
  expect(await screen.findByLabelText("비밀번호")).toHaveAttribute(
    "type",
    "password",
  );
  expect(router.state.location.pathname).toBe("/login");
  expect(
    fetcher.mock.calls.some(([path]) =>
      String(path).startsWith("/api/resumes"),
    ),
  ).toBe(false);
});

it("real login establishes identity and navigates to the registered API-backed list", async () => {
  useSessionStore.getState().clear();
  const router = open("/login");
  credentials();
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(
    await screen.findByRole("link", { name: "지원용 편집" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/resumes");
  expect(fetcher.mock.calls.map(([path]) => path)).toContain("/api/auth/login");
  expect(useSessionStore.getState().user).toEqual({ nickname: "지우" });
});

it("real signup auto-login reaches the same registered list without submitting login", async () => {
  useSessionStore.getState().clear();
  const router = open("/signup");
  credentials();
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: "지우" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
    target: { value: "demo1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(
    await screen.findByRole("link", { name: "지원용 편집" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/resumes");
  expect(fetcher.mock.calls.map(([path]) => path)).toContain(
    "/api/auth/signup",
  );
  expect(fetcher.mock.calls.map(([path]) => path)).not.toContain(
    "/api/auth/login",
  );
});

it("header logout reaches the real login and subsequent protected entry stays protected", async () => {
  const router = open("/resumes");
  await screen.findByRole("link", { name: "지원용 편집" });
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByLabelText("비밀번호")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
  expect(useSessionStore.getState().status).toBe("anonymous");
  await router.navigate("/resumes");
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(
    screen.queryByRole("link", { name: "지원용 편집" }),
  ).not.toBeInTheDocument();
});

it("top-level print route neither fetches a resume nor exposes document content", () => {
  open(`/print/${testResume().id}`);
  expect(
    screen.getByText("인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다."),
  ).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByText("개발자")).not.toBeInTheDocument();
});

it("authenticated iframe route reaches the real print screen without application chrome", async () => {
  vi.stubGlobal("top", {});
  vi.spyOn(window, "print").mockImplementation(() => undefined);
  open(`/print/${testResume().id}`);
  expect(
    await screen.findByRole("heading", { name: "지우", level: 1 }),
  ).toBeInTheDocument();
  expect(fetcher.mock.calls.map(([path]) => path)).toContain(
    `/api/resumes/${testResume().id}`,
  );
  expect(screen.queryByText("ResumeCraft")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "로그아웃" }),
  ).not.toBeInTheDocument();
});

it("not-found editor response stays inline without inventing or creating a resume", async () => {
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        meta: {},
        code: "404",
        message: "이력서를 찾을 수 없습니다.",
        field: null,
      }),
      { status: 404 },
    ),
  );
  const router = open(`/resumes/${testResume().id}/edit`);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "이력서를 찾을 수 없습니다.",
  );
  expect(router.state.location.pathname).toBe(
    `/resumes/${testResume().id}/edit`,
  );
  expect(screen.queryByLabelText("희망 직무")).not.toBeInTheDocument();
  expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(
    true,
  );
});

it("authenticated header reaches the real invoice list and selected document editor", async () => {
  const router = open();
  await screen.findByRole("link", { name: "지원용 편집" });
  fireEvent.click(screen.getByRole("button", { name: "견적서" }));
  const selected = await screen.findByRole("link", {
    name: testInvoice().title,
  });
  expect(router.state.location.pathname).toBe("/invoices");
  expect(screen.getByTestId("A-INV-H-INVOICES")).toHaveAttribute(
    "aria-current",
    "page",
  );
  fireEvent.click(selected);
  expect(await screen.findByLabelText("공급자 상호")).toHaveValue(
    testInvoice().content.supplier.name,
  );
  expect(router.state.location.pathname).toBe(
    `/invoices/${testInvoice().id}/edit`,
  );
  expect(fetcher.mock.calls.map(([path]) => path)).toContain(
    `/api/invoices/${testInvoice().id}`,
  );
});

it.each([
  "/invoices",
  `/invoices/${testInvoice().id}/edit`,
  `/print/invoice/${testInvoice().id}`,
])(
  "anonymous invoice entry %s reaches login without reading private documents",
  async (path) => {
    useSessionStore.getState().clear();
    const router = open(path);
    expect(await screen.findByLabelText("비밀번호")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).startsWith("/api/invoices"),
      ),
    ).toBe(false);
    expect(
      screen.queryByRole("navigation", { name: "문서 메뉴" }),
    ).not.toBeInTheDocument();
  },
);

it("invoice top-level print does not fetch document data or expose the shell", () => {
  open(`/print/invoice/${testInvoice().id}`);
  expect(
    screen.getByText("인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다."),
  ).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByText("ResumeCraft")).not.toBeInTheDocument();
});

it("invoice iframe route uses the real A4 renderer without application chrome", async () => {
  vi.stubGlobal("top", {});
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open(`/print/invoice/${testInvoice().id}`);
  expect(await screen.findByTestId("invoice-paper")).toHaveTextContent(
    testInvoice().doc_no,
  );
  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  expect(fetcher.mock.calls.map(([path]) => path)).toContain(
    `/api/invoices/${testInvoice().id}`,
  );
  expect(screen.queryByText("ResumeCraft")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("navigation", { name: "문서 메뉴" }),
  ).not.toBeInTheDocument();
});

it("invoice missing document keeps the real editor route and never creates replacement data", async () => {
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        meta: {},
        code: "404",
        message: "문서를 찾을 수 없습니다.",
        field: null,
      }),
      { status: 404 },
    ),
  );
  const router = open(`/invoices/${testInvoice().id}/edit`);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "문서를 찾을 수 없습니다.",
  );
  expect(router.state.location.pathname).toBe(
    `/invoices/${testInvoice().id}/edit`,
  );
  expect(screen.queryByLabelText("공급자 상호")).not.toBeInTheDocument();
  expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(
    true,
  );
});

it("invoice header departure waits for the actual dirty editor snapshot PUT", async () => {
  const router = open(`/invoices/${testInvoice().id}/edit`);
  const title = await screen.findByLabelText("제목");
  fireEvent.change(title, { target: { value: "메뉴 이동 전 최신 제목" } });
  fireEvent.click(screen.getByTestId("A-INE-H-RESUMES"));
  await screen.findByRole("link", { name: "지원용 편집" });
  expect(router.state.location.pathname).toBe("/resumes");
  const calls = fetcher.mock.calls;
  const saved = calls.findIndex(([, init]) => init?.method === "PUT");
  const listed = calls.findIndex(([path]) => path === "/api/resumes");
  expect(saved).toBeGreaterThanOrEqual(0);
  expect(listed).toBeGreaterThan(saved);
  expect(JSON.parse(calls[saved][1]!.body as string).title).toBe(
    "메뉴 이동 전 최신 제목",
  );
});

it("failed document menu flush retains the current screen and does not request its destination", async () => {
  const router = open();
  await screen.findByRole("link", { name: "지원용 편집" });
  const remove = registerNavigationFlush(async () => {
    throw new Error("저장 실패");
  });
  try {
    fireEvent.click(screen.getByRole("button", { name: "견적서" }));
    expect(await screen.findByRole("status")).toHaveTextContent("저장 실패");
    expect(router.state.location.pathname).toBe("/resumes");
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).startsWith("/api/invoices"),
      ),
    ).toBe(false);
  } finally {
    remove();
  }
});
