import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppRoutes, type Screens } from "../../app/router";
import { useSessionStore } from "../../app/session";
import { useToast } from "../../shared/Toast";
import { ScLogin } from "./ScLogin";
import { ScSignup } from "./ScSignup";
import { logout } from "./authApi";

const screens: Screens = {
  ScLogin,
  ScSignup,
  ScResumes: () => <p>본인 목록</p>,
  ScEditor: () => <p>편집기</p>,
  ScPrint: () => <p>인쇄</p>,
};
const fetcher = vi.fn();
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function error(status: number, message: string, field: string | null = null) {
  return json(
    { success: false, meta: {}, code: "UNAUTHORIZED", message, field },
    status,
  );
}
function mount(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes screens={screens} />
    </MemoryRouter>,
  );
}
function fill(signup = false) {
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "new@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "newpass123" },
  });
  if (signup) {
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "새사용자" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "newpass123" },
    });
  }
}
beforeEach(() => {
  useSessionStore.getState().clear();
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  document.cookie = "XSRF-TOKEN=auth-test; path=/";
});
afterEach(() => {
  vi.unstubAllGlobals();
  useToast.getState().dismiss();
});

it("login and signup are reachable by their public links with a non-clickable logo", () => {
  mount();
  expect(screen.getByText("ResumeCraft")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "로그아웃" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("link", { name: "회원가입" }));
  expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
  expect(screen.getByLabelText("비밀번호 확인")).toHaveAttribute(
    "type",
    "password",
  );
  fireEvent.click(screen.getByRole("link", { name: "로그인" }));
  expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it("login uses real API client, CSRF, HTML refresh, and me before entering list", async () => {
  fetcher
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("HTML"))
    .mockResolvedValueOnce(
      json({ success: true, meta: {}, data: { nickname: "서버닉네임" } }),
    );
  mount();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByText("본인 목록");
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/auth/login",
    "/",
    "/api/auth/me",
  ]);
  const request = fetcher.mock.calls[0][1];
  expect(request.credentials).toBe("same-origin");
  expect(request.headers.get("X-XSRF-TOKEN")).toBe("auth-test");
  expect(JSON.parse(request.body)).toEqual({
    email: "new@resume.dev",
    password: "newpass123",
  });
  expect(useSessionStore.getState().user?.nickname).toBe("서버닉네임");
});
it("signup omits confirmation wire field and automatically enters list after me", async () => {
  fetcher
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("HTML"))
    .mockResolvedValueOnce(
      json({ success: true, meta: {}, data: { nickname: "새사용자" } }),
    );
  mount("/signup");
  fill(true);
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  await screen.findByText("본인 목록");
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/auth/signup",
    "/",
    "/api/auth/me",
  ]);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    email: "new@resume.dev",
    nickname: "새사용자",
    password: "newpass123",
  });
});
it("confirmation mismatch is a local field error and does not send signup", () => {
  mount("/signup");
  fill(true);
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
    target: { value: "different" },
  });
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(screen.getByText("비밀번호가 일치하지 않습니다.")).toBeInTheDocument();
  expect(screen.getByLabelText("비밀번호 확인")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  ["이메일", "abc@", "이메일 형식을 확인하세요."],
  ["닉네임", "가", "닉네임은 2~12자입니다."],
  ["닉네임", "가나다라마바사아자차카타파", "닉네임은 2~12자입니다."],
  ["비밀번호", "1234567", "비밀번호는 8자 이상입니다."],
])("signup rejects invalid %s before sending", (label, value, message) => {
  mount("/signup");
  fill(true);
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  expect(screen.getByText(message)).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it("server duplicate error keeps signup form and maps email error", async () => {
  fetcher.mockResolvedValueOnce(
    error(409, "이미 가입된 이메일입니다", "email"),
  );
  mount("/signup");
  fill(true);
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("이메일")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("button", { name: "회원가입" })).toBeEnabled();
  expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("login 401 keeps original form, unlocks submission, and never retries automatically", async () => {
  fetcher.mockResolvedValueOnce(error(401, "인증 정보를 확인해 주세요."));
  mount();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("이메일")).toHaveValue("new@resume.dev");
  expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([401, 500])(
  "login me failure %s does not fabricate a user or redirect",
  async (status) => {
    fetcher
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("HTML"))
      .mockResolvedValueOnce(error(status, "확인 실패"));
    mount();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("alert");
    expect(useSessionStore.getState().user).toBeNull();
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
    expect(fetcher).toHaveBeenCalledTimes(3);
  },
);
it("missing nickname is a contract error, not a fabricated anonymous or authenticated user", async () => {
  fetcher
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("HTML"))
    .mockResolvedValueOnce(json({ success: true, meta: {}, data: {} }));
  mount();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("본인 목록")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
});
it("signup confirmation failure after account creation never repeats account POST", async () => {
  fetcher
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("HTML"))
    .mockResolvedValueOnce(error(500, "확인 실패"));
  mount("/signup");
  fill(true);
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("가입은 완료");
  expect(screen.getByRole("button", { name: "회원가입" })).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("signup me 401 navigates to existing login", async () => {
  fetcher
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("HTML"))
    .mockResolvedValueOnce(error(401, "확인 실패"));
  mount("/signup");
  fill(true);
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  await screen.findByRole("heading", { name: "로그인" });
});
it("pending signup locks inputs, submit and link and sends only once", async () => {
  let complete: (value: Response) => void = () => undefined;
  fetcher.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  mount("/signup");
  fill(true);
  const button = screen.getByRole("button", { name: "회원가입" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByLabelText("이메일")).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => complete(error(409, "이미 가입된 이메일입니다")));
  await waitFor(() => expect(button).toBeEnabled());
});
it.each(["/login", "/signup"])(
  "authenticated %s entry redirects to list",
  (path) => {
    useSessionStore.setState({
      status: "authenticated",
      user: { nickname: "지우" },
    });
    mount(path);
    expect(screen.getByText("본인 목록")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it("logout waits for serialized save then sends bodyless POST and refreshes HTML", async () => {
  fetcher
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response("HTML"));
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
  });
  const flush = vi.fn(async () => expect(fetcher).not.toHaveBeenCalled());
  await logout(flush);
  expect(flush).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/auth/logout",
    "/",
  ]);
  expect(fetcher.mock.calls[0][1].body).toBeUndefined();
  expect(useSessionStore.getState().status).toBe("anonymous");
});
it("failed flush prevents logout and retains authenticated state", async () => {
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
  });
  await expect(
    logout(async () => {
      throw new Error("save failed");
    }),
  ).rejects.toThrow("save failed");
  expect(fetcher).not.toHaveBeenCalled();
  expect(useSessionStore.getState().status).toBe("authenticated");
});
it("failed logout retains session UI", async () => {
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
  });
  fetcher.mockResolvedValueOnce(error(500, "종료 실패"));
  await expect(logout()).rejects.toThrow("종료 실패");
  expect(useSessionStore.getState().status).toBe("authenticated");
});
