import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

function response(status: number, body: unknown, token = "csrf-fixture") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "X-CSRF-TOKEN": token },
  });
}
function error(
  status = 401,
  message = "이메일 또는 비밀번호를 확인해주세요.",
  field: string | null = null,
) {
  return response(status, {
    success: false,
    meta: {},
    code: "UNAUTHORIZED",
    message,
    field,
  });
}
function anonymous() {
  return error();
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function mount(
  page: "login" | "signup",
  fetcher: ReturnType<typeof vi.fn>,
) {
  vi.stubGlobal("fetch", fetcher);
  const { LoginPage } = await import("./LoginPage");
  const { SignupPage } = await import("./SignupPage");
  const { setUnauthorizedHandler } = await import("../../api/apiClient");
  const redirect = vi.fn();
  setUnauthorizedHandler(redirect);
  render(
    <MemoryRouter initialEntries={[`/${page}`]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/resumes" element={<h1>나의 이력서</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", {
    name: page === "login" ? "로그인" : "회원가입",
  });
  return redirect;
}
function credentials() {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "jiwoo@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "demo1234" },
  });
}
function signupValues() {
  credentials();
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: "😀😀" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
    target: { value: "demo1234" },
  });
}

describe("공개 인증 화면과 실제 session API client", () => {
  it("로그인과 회원가입을 실제 route 링크로 왕복한다", async () => {
    await mount("login", vi.fn().mockResolvedValue(anonymous()));
    fireEvent.click(screen.getByRole("link", { name: "회원가입" }));
    expect(await screen.findByLabelText("닉네임")).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "로그인" }));
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
  });
  it("로그인 성공은 CSRF 전송과 같은 session me 확인 뒤 /resumes로 이동한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(anonymous())
      .mockResolvedValueOnce(response(200, { success: true, meta: {} }))
      .mockResolvedValueOnce(
        response(200, { success: true, meta: {}, data: { nickname: "지우" } }),
      );
    const redirect = await mount("login", fetcher);
    credentials();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("heading", { name: "나의 이력서" });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/auth/me",
      "/api/auth/login",
      "/api/auth/me",
    ]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      email: "jiwoo@resume.dev",
      password: "demo1234",
    });
    expect(
      new Headers(fetcher.mock.calls[1][1].headers).get("X-CSRF-TOKEN"),
    ).toBe("csrf-fixture");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("잘못된 자격증명401은 전역redirect 없이 입력과 로그인 폼을 유지한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(anonymous())
      .mockResolvedValueOnce(error());
    const redirect = await mount("login", fetcher);
    credentials();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이메일 또는 비밀번호를 확인해주세요.",
    );
    expect(screen.getByLabelText("이메일")).toHaveValue("jiwoo@resume.dev");
    expect(
      screen.queryByRole("heading", { name: "나의 이력서" }),
    ).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("응답 대기 중 중복 로그인 제출과 조기 이동을 막는다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(anonymous())
      .mockImplementationOnce(() => new Promise(() => {}));
    await mount("login", fetcher);
    credentials();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(
      await screen.findByRole("button", { name: "로그인 중…" }),
    ).toBeDisabled();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("heading", { name: "나의 이력서" }),
    ).not.toBeInTheDocument();
  });

  it("가입 확인값은 UI에서만 비교하고 승인된 세 필드만 전송한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(anonymous())
      .mockResolvedValueOnce(response(201, { success: true, meta: {} }))
      .mockResolvedValueOnce(
        response(200, { success: true, meta: {}, data: { nickname: "😀😀" } }),
      );
    await mount("signup", fetcher);
    signupValues();
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await screen.findByRole("heading", { name: "나의 이력서" });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      email: "jiwoo@resume.dev",
      nickname: "😀😀",
      password: "demo1234",
    });
    expect(fetcher.mock.calls[1][0]).toBe("/api/auth/signup");
  });

  it("확인 불일치는 요청하지 않고 해당 입력 오류를 연결한다", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(anonymous());
    await mount("signup", fetcher);
    signupValues();
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText("비밀번호가 일치하지 않습니다.")).toBeVisible();
    expect(screen.getByLabelText("비밀번호 확인")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    ["닉네임", "가", "닉네임은 2~12자로 입력해주세요."],
    ["닉네임", "가나다라마바사아자차카타파", "닉네임은 2~12자로 입력해주세요."],
    ["비밀번호", "1234567", "비밀번호는 8자 이상 입력해주세요."],
    ["이메일", "abc@", "이메일 형식을 확인해주세요."],
  ])("가입 %s 경계 오류를 요청 전 표시한다", async (field, value, message) => {
    const fetcher = vi.fn().mockResolvedValueOnce(anonymous());
    await mount("signup", fetcher);
    signupValues();
    fireEvent.change(screen.getByLabelText(field), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText(message)).toBeVisible();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("중복 가입409는 필드 오류와 하단 토스트를 보이고 가입 화면을 유지한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(anonymous())
      .mockResolvedValueOnce(error(409, "이미 가입된 이메일입니다", "email"));
    await mount("signup", fetcher);
    signupValues();
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이미 가입된 이메일입니다",
    );
    expect(screen.getByLabelText("이메일")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("heading", { name: "회원가입" })).toBeVisible();
  });

  it.each(["login", "signup"] as const)(
    "인증된 사용자의 /%s는 /resumes로 redirect한다",
    async (page) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          response(200, {
            success: true,
            meta: {},
            data: { nickname: "지우" },
          }),
        ),
      );
      const { LoginPage } = await import("./LoginPage");
      const { SignupPage } = await import("./SignupPage");
      render(
        <MemoryRouter initialEntries={[`/${page}`]}>
          <Routes>
            <Route
              path={`/${page}`}
              element={page === "login" ? <LoginPage /> : <SignupPage />}
            />
            <Route path="/resumes" element={<h1>나의 이력서</h1>} />
          </Routes>
        </MemoryRouter>,
      );
      await screen.findByRole("heading", { name: "나의 이력서" });
      expect(screen.queryByLabelText("비밀번호")).not.toBeInTheDocument();
    },
  );

  it("네트워크 실패는 빈 폼 성공이나 인증으로 가장하지 않는다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(anonymous())
      .mockRejectedValueOnce(new Error("연결 실패"));
    await mount("login", fetcher);
    credentials();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결 실패");
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });

  it("공개 폼은 빈 입력으로 시작하고 사용자 nickname/logout을 만들지 않는다", async () => {
    await mount("signup", vi.fn().mockResolvedValueOnce(anonymous()));
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
    expect(screen.queryByText("로그아웃")).not.toBeInTheDocument();
  });

  it("로그아웃은 저장 선행 port 완료 후 종료 요청하고 /login으로 이동한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, {
          success: true,
          meta: {},
          data: { nickname: "지우" },
        }),
      )
      .mockResolvedValueOnce(response(200, { success: true, meta: {} }));
    vi.stubGlobal("fetch", fetcher);
    const { LogoutButton } = await import("./LogoutButton");
    const beforeLogout = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/resumes"]}>
        <Routes>
          <Route
            path="/resumes"
            element={<LogoutButton beforeLogout={beforeLogout} />}
          />
          <Route path="/login" element={<h1>로그인</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    expect(beforeLogout).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/auth/logout");
  });

  it("저장 선행 실패는 세션 종료나 이동 없이 오류를 표시한다", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { LogoutButton } = await import("./LogoutButton");
    render(
      <MemoryRouter>
        <LogoutButton
          beforeLogout={() => Promise.reject(new Error("저장 실패"))}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 실패");
    await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
  });
});
