import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthBoundary } from "./AuthBoundary";
import { AuthHeader } from "./AuthHeader";
import { authRoutes } from "./authRoutes";

const unauthorized = () =>
  new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: "401",
      message: "로그인이 필요합니다.",
      field: null,
    }),
    { status: 401 },
  );
const ok = (data?: unknown) =>
  new Response(
    JSON.stringify({ success: true, meta: {}, ...(data ? { data } : {}) }),
  );
let authenticated = false;
let request: ReturnType<typeof vi.fn>;

beforeEach(() => {
  authenticated = false;
  document.cookie = ["XSRF-TOKEN", "test-token"].join("=") + "; path=/";
  request = vi.fn(async (path: string) => {
    if (path === "/api/auth/me")
      return authenticated ? ok({ nickname: "지우" }) : unauthorized();
    if (path === "/api/auth/login" || path === "/api/auth/signup") {
      authenticated = true;
      return ok();
    }
    if (path === "/api/auth/logout") {
      authenticated = false;
      return ok();
    }
    return ok();
  });
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("password visibility can be toggled without submitting credentials", async () => {
  mount("/login");
  const input = await screen.findByLabelText("비밀번호", { exact: true });
  expect(input.getAttribute("type")).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
  expect(input.getAttribute("type")).toBe("text");
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 숨기기" }));
  expect(input.getAttribute("type")).toBe("password");
  expect(request.mock.calls.some(([path]) => path === "/api/auth/login")).toBe(
    false,
  );
});
it("print authentication failures notify the parent instead of leaving export busy", async () => {
  const notify = vi.spyOn(window.parent, "postMessage");
  render(
    <MemoryRouter initialEntries={["/print/resume"]}>
      <Routes>
        <Route
          path="/print/:id"
          element={
            <AuthBoundary>
              <p>document</p>
            </AuthBoundary>
          }
        />
        <Route path="/login" element={<p>login screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("login screen");
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({ type: "resume-print-error" }),
    window.location.origin,
  );
});
function mount(
  path: string,
  beforeLogout?: () => Promise<void>,
  onLoggedOut?: () => void,
) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {authRoutes.map((route) => (
          <Route key={route.path} {...route} />
        ))}
        <Route
          path="/resumes"
          element={
            <AuthBoundary>
              <AuthHeader
                beforeLogout={beforeLogout}
                onLoggedOut={onLoggedOut}
              />
              <h1>내 이력서</h1>
            </AuthBoundary>
          }
        />
        <Route
          path="/resumes/:id/edit"
          element={
            <AuthBoundary>
              <h1>이력서 편집</h1>
            </AuthBoundary>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}
async function fillSignup(confirmation = "abcdefgh") {
  await screen.findByRole("heading", { name: "회원가입" });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "New@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: "😀😀" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
    target: { value: "abcdefgh" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
}

it("login submits the JSON contract with CSRF and navigates only after success to the protected list", async () => {
  mount("/login");
  await screen.findByRole("heading", { name: "로그인" });
  expect(screen.queryByText("지우")).toBeNull();
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "jiwoo@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "demo1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeDefined();
  expect(await screen.findByText("지우")).toBeDefined();
  const call = request.mock.calls.find(([path]) => path === "/api/auth/login");
  expect(JSON.parse(call?.[1].body)).toEqual({
    email: "jiwoo@resume.dev",
    password: "demo1234",
  });
  expect(call?.[1].headers.get("X-XSRF-TOKEN")).toBe("test-token");
});

it("signup confirmation stays local while successful registration reaches the authenticated list", async () => {
  mount("/signup");
  await fillSignup();
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeDefined();
  const call = request.mock.calls.find(([path]) => path === "/api/auth/signup");
  expect(JSON.parse(call?.[1].body)).toEqual({
    email: "New@resume.dev",
    nickname: "😀😀",
    password: "abcdefgh",
  });
});

it("signup mismatch blocks the API and leaves entered values editable", async () => {
  mount("/signup");
  await fillSignup("different");
  expect(screen.getByText("비밀번호가 일치하지 않습니다.")).toBeDefined();
  expect(request.mock.calls.some(([path]) => path === "/api/auth/signup")).toBe(
    false,
  );
});

it.each([
  ["이메일", "abc@", "이메일 형식을 확인해 주세요."],
  ["닉네임", "a", "닉네임은 2~12자로 입력해 주세요."],
  ["닉네임", "abcdefghijklm", "닉네임은 2~12자로 입력해 주세요."],
  ["비밀번호", "1234567", "비밀번호는 8자 이상으로 입력해 주세요."],
])(
  "signup validates %s before sending a mutation",
  async (label, value, message) => {
    mount("/signup");
    await fillSignup("different");
    fireEvent.change(screen.getByLabelText(label, { exact: true }), {
      target: { value },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText(message)).toBeDefined();
    expect(
      request.mock.calls.some(([path]) => path === "/api/auth/signup"),
    ).toBe(false);
  },
);

it("duplicate email shows the actual API message inline and stays on signup", async () => {
  request.mockImplementation(async (path: string) =>
    path === "/api/auth/signup"
      ? new Response(
          JSON.stringify({
            success: false,
            meta: {},
            code: "DUPLICATE_EMAIL",
            message: "이미 가입된 이메일입니다",
            field: "email",
          }),
          { status: 409 },
        )
      : unauthorized(),
  );
  mount("/signup");
  await fillSignup();
  await waitFor(() =>
    expect(screen.getAllByText("이미 가입된 이메일입니다")).toHaveLength(2),
  );
  expect(screen.getByRole("heading", { name: "회원가입" })).toBeDefined();
});

it("failed credentials preserve login input and never show a successful list", async () => {
  request.mockImplementation(async () => unauthorized());
  mount("/login");
  await screen.findByRole("heading", { name: "로그인" });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "jiwoo@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByRole("alert")).toBeDefined();
  expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe(
    "jiwoo@resume.dev",
  );
  expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
});

it("pending submit cannot be duplicated or navigate before the server confirms", async () => {
  let finish!: (response: Response) => void;
  request.mockImplementation(async (path: string) => {
    if (path === "/api/auth/login")
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    if (path === "/api/auth/me")
      return authenticated ? ok({ nickname: "지우" }) : unauthorized();
    return ok();
  });
  mount("/login");
  await screen.findByRole("heading", { name: "로그인" });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "jiwoo@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "demo1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.submit(
    screen.getByRole("button", { name: "처리 중…" }).closest("form")!,
  );
  expect(
    request.mock.calls.filter(([path]) => path === "/api/auth/login"),
  ).toHaveLength(1);
  expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  authenticated = true;
  finish(ok());
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeDefined();
});

it.each(["/login", "/signup"])(
  "authenticated entry to %s goes to the list",
  async (path) => {
    authenticated = true;
    mount(path);
    expect(
      await screen.findByRole("heading", { name: "내 이력서" }),
    ).toBeDefined();
  },
);

it("login signup links are real navigable routes", async () => {
  mount("/login");
  fireEvent.click(
    await screen.findByRole("link", { name: "계정이 없나요? 회원가입" }),
  );
  expect(
    await screen.findByRole("heading", { name: "회원가입" }),
  ).toBeDefined();
  fireEvent.click(
    screen.getByRole("link", { name: "이미 계정이 있나요? 로그인" }),
  );
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeDefined();
});

it.each(["/resumes", "/resumes/owned-id/edit"])(
  "anonymous protected entry %s renders login, not private content",
  async (path) => {
    mount(path);
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "이력서 편집" })).toBeNull();
  },
);

it("logout waits for editor flush, clears drafts only after success, and reaches login", async () => {
  authenticated = true;
  const sequence: string[] = [];
  const flush = vi.fn(async () => {
    sequence.push("flush");
  });
  const clear = vi.fn(() => {
    sequence.push("clear");
  });
  const original = request.getMockImplementation()!;
  request.mockImplementation(async (path: string, options: RequestInit) => {
    if (path === "/api/auth/logout") sequence.push("logout");
    return original(path, options);
  });
  mount("/resumes", flush, clear);
  await screen.findByText("지우");
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeDefined();
  expect(sequence).toEqual(["flush", "logout", "clear"]);
  expect(screen.queryByText("지우")).toBeNull();
});

it("failed flush keeps the screen and draft and does not terminate the session", async () => {
  authenticated = true;
  const clear = vi.fn();
  mount(
    "/resumes",
    async () => {
      throw new Error("저장 실패");
    },
    clear,
  );
  await screen.findByText("지우");
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.getByRole("heading", { name: "내 이력서" })).toBeDefined();
  expect(request.mock.calls.some(([path]) => path === "/api/auth/logout")).toBe(
    false,
  );
  expect(clear).not.toHaveBeenCalled();
});

it("failed logout retains the session screen and does not discard drafts", async () => {
  authenticated = true;
  const clear = vi.fn();
  const original = request.getMockImplementation()!;
  request.mockImplementation(async (path: string, options: RequestInit) =>
    path === "/api/auth/logout"
      ? new Response(
          JSON.stringify({
            success: false,
            meta: {},
            code: "500",
            message: "처리 실패",
            field: null,
          }),
          { status: 500 },
        )
      : original(path, options),
  );
  mount("/resumes", undefined, clear);
  await screen.findByText("지우");
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.getByRole("heading", { name: "내 이력서" })).toBeDefined();
  expect(clear).not.toHaveBeenCalled();
});

it("unknown connection failure offers retry instead of assuming anonymous or showing a fake user", async () => {
  request.mockRejectedValue(new Error("network"));
  mount("/login");
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.queryByLabelText("이메일")).toBeNull();
  request.mockImplementation(async () => unauthorized());
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeDefined();
});
