import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { authRoutes } from "../../app/router";
import { LogoutButton } from "./LogoutButton";

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {authRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="/resumes" element={<h1>내 이력서</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value },
  });
}
function submit(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}
const success = (data?: unknown) =>
  new Response(
    JSON.stringify({
      success: true,
      meta: {},
      ...(data ? { data } : {}),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
const failure = (
  status: number,
  message: string,
  field: string | null = null,
) =>
  new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: status === 409 ? "DUPLICATE_EMAIL" : "INVALID_STRUCTURE",
      message,
      field,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  document.cookie = "XSRF-TOKEN=auth-test; path=/";
  fetcher = vi
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/auth/me" ? success({ nickname: "지우" }) : success(),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public authentication routes", () => {
  it("uses email semantics and restores password masking after visibility toggles", () => {
    renderRoute("/login");
    expect(screen.getByLabelText("이메일", { exact: true })).toHaveProperty(
      "type",
      "email",
    );
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
    expect(screen.getByLabelText("비밀번호", { exact: true })).toHaveProperty(
      "type",
      "text",
    );
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 숨기기" }));
    expect(screen.getByLabelText("비밀번호", { exact: true })).toHaveProperty(
      "type",
      "password",
    );
  });
  it("login starts empty, masked, has a signup entry, and shows no private header", () => {
    renderRoute("/login");
    expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("비밀번호", { exact: true }) as HTMLInputElement)
        .type,
    ).toBe("password");
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
    expect(screen.queryByText("지우")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
    expect(
      (screen.getByLabelText("비밀번호", { exact: true }) as HTMLInputElement)
        .type,
    ).toBe("text");
    fireEvent.click(screen.getByRole("link", { name: "회원가입 →" }));
    expect(screen.getByLabelText("비밀번호 확인")).toBeDefined();
  });

  it("login sends only credentials and awaits same-session me before navigating to resumes", async () => {
    renderRoute("/login");
    fill("이메일", " Jiwoo@resume.dev ");
    fill("비밀번호", "demo1234");
    submit("로그인");
    await screen.findByRole("heading", { name: "내 이력서" });
    const [path, init] = fetcher.mock.calls.find(
      ([path]) => path === "/api/auth/login",
    )!;
    expect(path).toBe("/api/auth/login");
    expect(JSON.parse(init.body)).toEqual({
      email: "Jiwoo@resume.dev",
      password: "demo1234",
    });
    expect(init.credentials).toBe("same-origin");
    expect(init.headers.get("X-XSRF-TOKEN")).toBe("auth-test");
    expect(fetcher.mock.calls.some(([path]) => path === "/api/auth/me")).toBe(
      true,
    );
  });

  it("signup sends no password confirmation and automatically reaches resumes", async () => {
    renderRoute("/signup");
    fill("이메일", "new@example.dev");
    fill("닉네임", "😀😀");
    fill("비밀번호", "abcdefgh");
    fill("비밀번호 확인", "abcdefgh");
    submit("회원가입");
    await screen.findByRole("heading", { name: "내 이력서" });
    const [, init] = fetcher.mock.calls.find(
      ([path]) => path === "/api/auth/signup",
    )!;
    expect(JSON.parse(init.body)).toEqual({
      email: "new@example.dev",
      nickname: "😀😀",
      password: "abcdefgh",
    });
  });

  it.each([
    ["이메일", "bad", "이메일 형식을 확인해 주세요."],
    ["닉네임", "가", "닉네임은 2~12자여야 합니다."],
    ["닉네임", "가나다라마바사아자차카타파", "닉네임은 2~12자여야 합니다."],
    ["비밀번호", "abcdefg", "비밀번호는 8자 이상이어야 합니다."],
    ["비밀번호 확인", "different", "비밀번호가 일치하지 않습니다."],
  ])(
    "signup blocks invalid %s without an HTTP write",
    (label, value, message) => {
      renderRoute("/signup");
      fill("이메일", "new@example.dev");
      fill("닉네임", "가나");
      fill("비밀번호", "abcdefgh");
      fill("비밀번호 확인", "abcdefgh");
      fill(label, value);
      submit("회원가입");
      expect(screen.getByText(message)).toBeDefined();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("duplicate email preserves the form, attaches field error and shows toast for three seconds", async () => {
    fetcher.mockResolvedValue(
      failure(409, "이미 가입된 이메일입니다", "email"),
    );
    renderRoute("/signup");
    fill("이메일", "new@example.dev");
    fill("닉네임", "가나");
    fill("비밀번호", "abcdefgh");
    fill("비밀번호 확인", "abcdefgh");
    submit("회원가입");
    await screen.findByRole("alert");
    expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe(
      "new@example.dev",
    );
    expect(screen.getByLabelText("이메일").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });

  it("removes the toast after exactly three seconds", async () => {
    vi.useFakeTimers();
    fetcher.mockResolvedValue(failure(401, "인증 실패"));
    renderRoute("/login");
    fill("이메일", "user@example.dev");
    fill("비밀번호", "wrong");
    await act(async () => {
      submit("로그인");
    });
    expect(screen.getByRole("alert").textContent).toBe("인증 실패");
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole("alert")).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("login credential failure remains on login and never calls me", async () => {
    fetcher.mockResolvedValue(
      failure(401, "이메일 또는 비밀번호를 확인해 주세요."),
    );
    renderRoute("/login");
    fill("이메일", "unknown@example.dev");
    fill("비밀번호", "wrong");
    submit("로그인");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "이메일 또는 비밀번호",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "로그인" })).toBeDefined();
  });

  it("me failure does not claim authenticated success", async () => {
    fetcher.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/auth/me"
          ? failure(401, "로그인이 필요합니다.")
          : success(),
      ),
    );
    renderRoute("/login");
    fill("이메일", "user@example.dev");
    fill("비밀번호", "abcdefgh");
    submit("로그인");
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });

  it("network failure is retryable without leaving the form", async () => {
    fetcher.mockRejectedValueOnce(new Error("연결 실패"));
    renderRoute("/login");
    fill("이메일", "user@example.dev");
    fill("비밀번호", "abcdefgh");
    submit("로그인");
    await screen.findByRole("alert");
    submit("로그인");
    await screen.findByRole("heading", { name: "내 이력서" });
  });

  it("pending authentication blocks a concurrent submission and shows loading", async () => {
    let resolve!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    renderRoute("/login");
    fill("이메일", "user@example.dev");
    fill("비밀번호", "abcdefgh");
    submit("로그인");
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(
      (screen.getByRole("button", { name: "로그인 중…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.submit(
      screen.getByRole("button", { name: "로그인 중…" }).closest("form")!,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(success());
    });
    await screen.findByRole("heading", { name: "내 이력서" });
  });

  it("logout waits for the editor guard then navigates to login", async () => {
    const guard = vi.fn().mockResolvedValue(true);
    render(
      <MemoryRouter initialEntries={["/resumes"]}>
        <Routes>
          <Route
            path="/resumes"
            element={<LogoutButton beforeLogout={guard} />}
          />
          <Route path="/login" element={<h1>로그인 화면</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    submit("로그아웃");
    await screen.findByRole("heading", { name: "로그인 화면" });
    expect(guard).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/auth/logout");
  });

  it("logout guard refusal does not call the server or navigate", async () => {
    const guard = vi.fn().mockResolvedValue(false);
    render(
      <MemoryRouter>
        <LogoutButton beforeLogout={guard} />
      </MemoryRouter>,
    );
    submit("로그아웃");
    await waitFor(() => expect(guard).toHaveBeenCalledTimes(1));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
