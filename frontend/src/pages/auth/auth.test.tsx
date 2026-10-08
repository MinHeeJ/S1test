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
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { LogoutButton } from "./LogoutButton";
import { login, logout, AuthApiError } from "./authApi";

function response(status: number, body: unknown, token?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(
      token ? { "X-CSRF-TOKEN": token, "X-CSRF-HEADER": "X-CSRF-TOKEN" } : {},
    ),
    json: async () => body,
  } as Response;
}
const success = { success: true, meta: {} };
const current = { ...success, data: { nickname: "지우" } };
const bootstrap = () =>
  response(
    401,
    { success: false, code: "Unauthorized", message: "Unauthorized" },
    "token",
  );
const transport = vi.fn<typeof fetch>();

function mount(path: "/login" | "/signup", element?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={element ?? <LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/resumes" element={<h1>내 이력서</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
function fillSignup(
  nickname = "가입자",
  password = "abcdefgh",
  confirmation = password,
) {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "New@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: nickname },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
    target: { value: confirmation },
  });
}
function fillLogin() {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "jiwoo@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "demo1234" },
  });
}
function succeeds() {
  transport
    .mockResolvedValueOnce(bootstrap())
    .mockResolvedValueOnce(response(200, success))
    .mockResolvedValueOnce(response(200, current));
}

beforeEach(() => {
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SCR-SIGNUP /signup", () => {
  it("빈 폼과 마스킹된 비밀번호를 표시한다", () => {
    mount("/signup");
    expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("비밀번호 확인") as HTMLInputElement).type,
    ).toBe("password");
    expect(transport).not.toHaveBeenCalled();
  });
  it("확인 일치를 로컬 검사하여 전송하지 않는다", () => {
    mount("/signup");
    fillSignup("가입자", "abcdefgh", "different");
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText("비밀번호가 일치하지 않습니다.")).toBeTruthy();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["가", "가나다라마바사아자차카타파"])(
    "닉네임 %s 길이 위반을 거부한다",
    (nickname) => {
      mount("/signup");
      fillSignup(nickname);
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
      expect(screen.getByText("닉네임은 2~12자여야 합니다.")).toBeTruthy();
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it("비밀번호 7자를 거부한다", () => {
    mount("/signup");
    fillSignup("가입자", "1234567");
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText("비밀번호는 8자 이상이어야 합니다.")).toBeTruthy();
    expect(transport).not.toHaveBeenCalled();
  });
  it("이메일 형식을 검증한다", () => {
    mount("/signup");
    fillSignup();
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "abc@" },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText("이메일 형식을 확인해 주세요.")).toBeTruthy();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["😀😀", "가나다라마바사아자차카타"])(
    "Unicode 허용 경계 %s로 가입 후 목록에 진입한다",
    async (nickname) => {
      succeeds();
      mount("/signup");
      fillSignup(nickname);
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
      await screen.findByRole("heading", { name: "내 이력서" });
      const [path, init] = transport.mock.calls[1];
      expect(path).toBe("/api/auth/signup");
      expect(JSON.parse(init?.body as string)).toEqual({
        email: "New@resume.dev",
        nickname,
        password: "abcdefgh",
      });
      expect(init?.credentials).toBe("same-origin");
      expect(init?.headers).toMatchObject({ "X-CSRF-TOKEN": "token" });
    },
  );
  it("중복 이메일은 서버 field와 3초 토스트로 표시하고 폼을 유지한다", async () => {
    transport.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(
      response(409, {
        success: false,
        meta: {},
        code: "DUPLICATE_EMAIL",
        message: "이미 가입된 이메일입니다",
        field: "email",
      }),
    );
    mount("/signup");
    fillSignup();
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toBe(
      "이미 가입된 이메일입니다",
    );
    expect(screen.getByLabelText("이메일").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
    vi.useFakeTimers();
    // A new failure schedules the timer while fake timers own the clock.
    transport.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(
      response(409, {
        code: "DUPLICATE_EMAIL",
        message: "이미 가입된 이메일입니다",
        field: "email",
      }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SCR-LOGIN /login", () => {
  it("CSRF bootstrap 뒤 로그인과 /me 확인을 완료하고 목록에 진입한다", async () => {
    succeeds();
    mount("/login");
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(transport.mock.calls.map((call) => call[0])).toEqual([
      "/api/auth/me",
      "/api/auth/login",
      "/api/auth/me",
    ]);
    expect(JSON.parse(transport.mock.calls[1][1]?.body as string)).toEqual({
      email: "jiwoo@resume.dev",
      password: "demo1234",
    });
  });
  it("요청 중 재제출을 막고 성공 전 이동하지 않는다", async () => {
    let finish!: (value: Response) => void;
    transport
      .mockResolvedValueOnce(bootstrap())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(response(200, current));
    mount("/login");
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    const busy = screen.getByRole("button", {
      name: "로그인 중…",
    }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    fireEvent.click(busy);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
    await act(async () => {
      finish(response(200, success));
    });
    await screen.findByRole("heading", { name: "내 이력서" });
  });
  it("자격증명 실패는 로그인에 머물며 수정 후 재시도할 수 있다", async () => {
    transport.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(
      response(401, {
        success: false,
        code: "Unauthorized",
        message: "Unauthorized",
        field: null,
      }),
    );
    mount("/login");
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "이메일 또는 비밀번호를 확인해 주세요.",
    );
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
    succeeds();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "내 이력서" });
  });
  it("네트워크 실패는 성공 이동을 만들지 않는다", async () => {
    transport.mockRejectedValueOnce(new TypeError("network"));
    mount("/login");
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "요청에 실패했습니다. 다시 시도해 주세요.",
    );
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });
  it("CSRF 누락 시 변이 요청을 보내지 않는다", async () => {
    transport.mockResolvedValueOnce(response(401, {}));
    await expect(login({ email: "legacy", password: "x" })).rejects.toThrow(
      "보안 확인",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("CSRF 거부를 오류로 표시한다", async () => {
    transport.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(
      response(403, {
        code: "Forbidden",
        message: "Forbidden",
        field: null,
      }),
    );
    mount("/login");
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Forbidden");
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });
  it("로그인 성공이어도 같은 세션 /me 실패면 보호 화면에 진입하지 않는다", async () => {
    transport
      .mockResolvedValueOnce(bootstrap())
      .mockResolvedValueOnce(response(200, success))
      .mockResolvedValueOnce(
        response(401, { code: "Unauthorized", message: "Unauthorized" }),
      );
    mount("/login");
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });
});

describe("로그아웃", () => {
  it("새 토큰으로 종료한 후 로그인 화면으로 이동한다", async () => {
    transport
      .mockResolvedValueOnce(response(200, current, "renewed"))
      .mockResolvedValueOnce(response(200, success));
    render(
      <MemoryRouter initialEntries={["/resumes"]}>
        <Routes>
          <Route path="/resumes" element={<LogoutButton />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    expect(transport.mock.calls[1][0]).toBe("/api/auth/logout");
    expect(transport.mock.calls[1][1]?.headers).toMatchObject({
      "X-CSRF-TOKEN": "renewed",
    });
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
  });
  it("미저장 처리 실패 시 세션 종료와 이동을 하지 않는다", async () => {
    const beforeLogout = vi.fn().mockRejectedValue(new Error("save failed"));
    mount("/login", <LogoutButton beforeLogout={beforeLogout} />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("alert");
    expect(transport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
  });
  it("실패한 세션 종료는 오류를 반환한다", async () => {
    transport
      .mockResolvedValueOnce(response(200, current, "renewed"))
      .mockResolvedValueOnce(
        response(500, {
          code: "Internal Server Error",
          message: "Internal Server Error",
          field: null,
        }),
      );
    await expect(logout()).rejects.toBeInstanceOf(AuthApiError);
  });
});
