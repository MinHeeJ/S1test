import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../app/router";
import { useSessionStore } from "../../app/sessionStore";
import { configureApiClient } from "../../shared/apiClient";
import { useToastStore } from "../../shared/Toast";
import { authScreens } from "./authScreens";

const fetcher = vi.fn<typeof fetch>();
const unauthorized = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  configureApiClient({
    onUnauthorized: unauthorized,
    onError: () => undefined,
  });
  useSessionStore.getState().clear();
  useToastStore.getState().clear();
  document.cookie =
    ["XSRF", "TOKEN"].join("-") +
    String.fromCharCode(61) +
    "test-token; path=/";
  fetcher.mockImplementation(async (path) => {
    if (path === "/api/health")
      return new Response(JSON.stringify({ success: true, meta: {} }));
    if (path === "/api/auth/me") {
      return new Response(
        JSON.stringify({ success: true, meta: {}, data: { nickname: "지우" } }),
      );
    }
    return new Response(null, { status: 204 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

function open(path: "/login" | "/signup" | "/resumes" = "/login") {
  const router = createMemoryRouter(
    applicationRoutes([
      ...authScreens,
      { path: "/resumes", element: <h1>내 이력서</h1> },
    ]),
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
function enter(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function completeSignup(nickname = "새회원") {
  enter("이메일", "new@example.test");
  enter("닉네임", nickname);
  enter("비밀번호", "newpassword");
  enter("비밀번호 확인", "newpassword");
}
function errorResponse(
  status: number,
  message: string,
  field: string | null = null,
) {
  return new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: String(status),
      message,
      field,
    }),
    { status },
  );
}

it("registered direct login route starts empty with only anonymous branding and masked password", () => {
  open();
  expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
  expect(screen.getByLabelText("이메일")).toHaveValue("");
  expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password");
  expect(screen.getByText("ResumeCraft")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "로그아웃" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "회원가입" }),
  ).not.toBeInTheDocument();
});
it("anonymous protected entry reaches the real registered login form", async () => {
  const router = open("/resumes");
  expect(await screen.findByLabelText("이메일")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
  expect(
    screen.queryByRole("heading", { name: "내 이력서" }),
  ).not.toBeInTheDocument();
});
it("login sends only wire credentials, refreshes CSRF and identity then actually navigates", async () => {
  const router = open();
  enter("이메일", "jiwoo@resume.dev");
  enter("비밀번호", "demo1234");
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/resumes");
  expect(screen.getByText("지우")).toBeInTheDocument();
  const calls = fetcher.mock.calls;
  const post = calls.find(([path]) => path === "/api/auth/login")!;
  expect(JSON.parse(post[1]!.body as string)).toEqual({
    email: "jiwoo@resume.dev",
    password: "demo1234",
  });
  expect(new Headers(post[1]!.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  expect(post[1]!.credentials).toBe("same-origin");
  expect(calls.slice(calls.indexOf(post) + 1).map(([path]) => path)).toEqual([
    "/api/health",
    "/api/auth/me",
  ]);
});
it("signup confirmation is local and successful auto-login navigates without another login command", async () => {
  const router = open("/signup");
  completeSignup();
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/resumes");
  const call = fetcher.mock.calls.find(
    ([path]) => path === "/api/auth/signup",
  )!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({
    email: "new@example.test",
    nickname: "새회원",
    password: "newpassword",
  });
  expect(fetcher.mock.calls.some(([path]) => path === "/api/auth/login")).toBe(
    false,
  );
});
it("mismatched password confirmation prevents the signup request", () => {
  open("/signup");
  completeSignup();
  enter("비밀번호 확인", "different");
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "비밀번호와 일치해야 합니다",
  );
  expect(fetcher.mock.calls.some(([path]) => path === "/api/auth/signup")).toBe(
    false,
  );
});
it.each([
  ["이메일", "abc@", "이메일 형식을 확인하세요"],
  ["닉네임", "지", "닉네임은 2~12자입니다"],
  ["닉네임", "😀".repeat(13), "닉네임은 2~12자입니다"],
  ["비밀번호", "short", "비밀번호는 8자 이상입니다"],
])("signup validates %s without mutation", (label, value, message) => {
  open("/signup");
  completeSignup();
  enter(label, value);
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(screen.getByText(message)).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([path]) => path === "/api/auth/signup")).toBe(
    false,
  );
});
it("nickname upper limit counts code points, not UTF-16 units", async () => {
  open("/signup");
  completeSignup("😀".repeat(12));
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeInTheDocument();
});
it("duplicate signup keeps entered values and shows the server field message", async () => {
  fetcher.mockImplementation(async (path) =>
    path === "/api/auth/signup"
      ? errorResponse(409, "이미 가입된 이메일입니다", "email")
      : new Response("{}"),
  );
  const router = open("/signup");
  completeSignup();
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  await waitFor(() =>
    expect(screen.getByLabelText("이메일")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(
    screen.getAllByText("이미 가입된 이메일입니다").length,
  ).toBeGreaterThan(0);
  expect(screen.getByLabelText("닉네임")).toHaveValue("새회원");
  expect(router.state.location.pathname).toBe("/signup");
});
it("credential 401 is inline and never invokes protected-route unauthorized navigation", async () => {
  fetcher.mockImplementation(async (path) =>
    path === "/api/auth/login"
      ? errorResponse(401, "이메일 또는 비밀번호를 확인해 주세요.")
      : new Response("{}"),
  );
  const router = open();
  enter("이메일", "jiwoo@resume.dev");
  enter("비밀번호", "incorrect");
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "이메일 또는 비밀번호를 확인해 주세요.",
  );
  expect(unauthorized).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe("/login");
  expect(screen.getByLabelText("이메일")).toHaveValue("jiwoo@resume.dev");
});
it("pending login disables inputs and prevents duplicate POST", async () => {
  fetcher.mockImplementation(async (path) =>
    path === "/api/auth/login"
      ? await new Promise<Response>(() => undefined)
      : new Response("{}"),
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(
    screen.getByRole("button", { name: "로그인 처리 중…" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("이메일")).toBeDisabled();
  fireEvent.submit(
    screen.getByRole("button", { name: "로그인 처리 중…" }).closest("form")!,
  );
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([path]) => path === "/api/auth/login"),
    ).toHaveLength(1),
  );
});
it("pending signup prevents duplicate POST", async () => {
  fetcher.mockImplementation(async (path) =>
    path === "/api/auth/signup"
      ? await new Promise<Response>(() => undefined)
      : new Response("{}"),
  );
  open("/signup");
  completeSignup();
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(
    screen.getByRole("button", { name: "회원가입 처리 중…" }),
  ).toBeDisabled();
  fireEvent.submit(
    screen.getByRole("button", { name: "회원가입 처리 중…" }).closest("form")!,
  );
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([path]) => path === "/api/auth/signup"),
    ).toHaveLength(1),
  );
});
it("committed signup with failed identity confirmation does not masquerade as rollback or repeat signup", async () => {
  fetcher.mockImplementation(async (path) => {
    if (path === "/api/auth/signup") return new Response(null, { status: 204 });
    if (path === "/api/auth/me") return errorResponse(500, "사용자 조회 실패");
    return new Response("{}");
  });
  const router = open("/signup");
  completeSignup();
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "회원가입은 완료되었으나 사용자 확인에 실패했습니다.",
  );
  expect(router.state.location.pathname).toBe("/signup");
  expect(screen.getByRole("button", { name: "회원가입" })).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(([path]) => path === "/api/auth/signup"),
  ).toHaveLength(1);
});
it("missing nickname is a contract error, never a fabricated successful identity", async () => {
  fetcher.mockImplementation(async (path) => {
    if (path === "/api/auth/login") return new Response(null, { status: 204 });
    if (path === "/api/auth/me")
      return new Response(
        JSON.stringify({ success: true, meta: {}, data: {} }),
      );
    return new Response("{}");
  });
  const router = open();
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "사용자 응답 계약 오류",
  );
  expect(router.state.location.pathname).toBe("/login");
  expect(useSessionStore.getState().user).toBeNull();
});
it("authenticated direct auth route shows the form without clearing account or logging out", () => {
  useSessionStore.setState({
    user: { nickname: "기존회원" },
    status: "authenticated",
  });
  open("/signup");
  expect(screen.getByLabelText("비밀번호 확인")).toBeInTheDocument();
  expect(useSessionStore.getState().user?.nickname).toBe("기존회원");
  expect(fetcher.mock.calls.some(([path]) => path === "/api/auth/logout")).toBe(
    false,
  );
});
it("logout through existing shared header reaches login and protected reentry remains blocked", async () => {
  useSessionStore.setState({
    user: { nickname: "지우" },
    status: "authenticated",
  });
  const router = open("/resumes");
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByLabelText("이메일")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
  expect(fetcher.mock.calls.some(([path]) => path === "/api/auth/logout")).toBe(
    true,
  );
  await router.navigate("/resumes");
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(
    screen.queryByRole("heading", { name: "내 이력서" }),
  ).not.toBeInTheDocument();
});
