import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { authRoutes } from "../../app/router";
import { LogoutButton } from "./LogoutButton";
import { getCurrentUser, login, logout, signup } from "./authApi";
import { ApiRequestError } from "../../shared/apiClient";

vi.mock("./authApi", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));
const anonymous = new ApiRequestError(401, {
  success: false,
  meta: {},
  code: "401",
  message: "로그인이 필요합니다.",
  field: null,
});
function page(path: string) {
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
async function credentials(joining = false) {
  await screen.findByRole("heading", { name: joining ? "회원가입" : "로그인" });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "new@resume.dev" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "password8" },
  });
  if (joining) {
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "새사용자" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "password8" },
    });
  }
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockRejectedValue(anonymous);
  vi.mocked(login).mockResolvedValue();
  vi.mocked(signup).mockResolvedValue();
  vi.mocked(logout).mockResolvedValue();
});
describe("authentication screen routes", () => {
  it("login shows an empty masked form on its real registered path", async () => {
    page("/login");
    await screen.findByRole("heading", { name: "로그인" });
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute(
      "type",
      "password",
    );
    expect(login).not.toHaveBeenCalled();
  });
  it("login submits once, confirms session and reaches the resume destination", async () => {
    page("/login");
    await credentials();
    let finish!: () => void;
    vi.mocked(login).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(getCurrentUser).mockResolvedValue({ nickname: "지우" });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(screen.getByRole("button", { name: "로그인 중…" })).toBeDisabled();
    fireEvent.submit(
      screen.getByRole("button", { name: "로그인 중…" }).closest("form")!,
    );
    expect(login).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(login).toHaveBeenCalledWith({
      email: "new@resume.dev",
      password: "password8",
    });
  });
  it("signup sends only approved fields and auto-login leads directly to resumes", async () => {
    page("/signup");
    await credentials(true);
    vi.mocked(getCurrentUser).mockResolvedValue({ nickname: "새사용자" });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(signup).toHaveBeenCalledWith({
      email: "new@resume.dev",
      nickname: "새사용자",
      password: "password8",
    });
    expect(login).not.toHaveBeenCalled();
  });
  it("signup mismatching confirmation prevents POST and keeps entered values", async () => {
    page("/signup");
    await credentials(true);
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(
      screen.getByText("비밀번호가 일치하지 않습니다."),
    ).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
    expect(screen.getByLabelText("이메일")).toHaveValue("new@resume.dev");
  });
  it.each([
    ["이메일", "abc@", "이메일 형식을 확인해 주세요."],
    ["닉네임", "가", "닉네임은 2~12자여야 합니다."],
    ["닉네임", "가나다라마바사아자차카타파", "닉네임은 2~12자여야 합니다."],
    ["비밀번호", "short", "비밀번호는 8자 이상이어야 합니다."],
  ])(
    "signup rejects invalid %s locally without writing",
    async (label, value, message) => {
      page("/signup");
      await credentials(true);
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(signup).not.toHaveBeenCalled();
    },
  );
  it("duplicate signup shows server field and toast while preserving form", async () => {
    page("/signup");
    await credentials(true);
    vi.mocked(signup).mockRejectedValue(
      new ApiRequestError(409, {
        success: false,
        meta: {},
        code: "DUPLICATE_EMAIL",
        message: "이미 가입된 이메일입니다",
        field: "email",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "이미 가입된 이메일입니다",
    );
    expect(screen.getByLabelText("이메일")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("비밀번호")).toHaveValue("password8");
    expect(
      screen.queryByRole("heading", { name: "내 이력서" }),
    ).not.toBeInTheDocument();
  });
  it("failed login stays on form and never automatically retries POST", async () => {
    page("/login");
    await credentials();
    vi.mocked(login).mockRejectedValue(anonymous);
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toHaveValue("password8");
    expect(login).toHaveBeenCalledTimes(1);
  });
  it("network failure preserves signup memory and does not retry", async () => {
    page("/signup");
    await credentials(true);
    vi.mocked(signup).mockRejectedValue(new TypeError("network"));
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("닉네임")).toHaveValue("새사용자");
    expect(signup).toHaveBeenCalledTimes(1);
  });
  it.each(["/login", "/signup"])(
    "existing session bypasses %s without ending authentication",
    async (path) => {
      vi.mocked(getCurrentUser).mockResolvedValue({ nickname: "지우" });
      page(path);
      await screen.findByRole("heading", { name: "내 이력서" });
      expect(logout).not.toHaveBeenCalled();
    },
  );
  it("session check failure displays retry instead of pretending anonymous", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new TypeError("network"));
    page("/login");
    await screen.findByRole("alert");
    vi.mocked(getCurrentUser).mockRejectedValue(anonymous);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: "로그인" });
  });
});
describe("logout orchestration", () => {
  function button(flush: () => Promise<void>) {
    render(
      <MemoryRouter initialEntries={["/resumes"]}>
        <Routes>
          <Route
            path="/resumes"
            element={<LogoutButton beforeLogout={flush} />}
          />
          <Route path="/login" element={<h1>로그인</h1>} />
        </Routes>
      </MemoryRouter>,
    );
  }
  it("flushes edits before logout and moves only after success", async () => {
    const order: string[] = [];
    const flush = vi.fn(async () => {
      order.push("save");
    });
    vi.mocked(logout).mockImplementation(async () => {
      order.push("logout");
    });
    button(flush);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    expect(order).toEqual(["save", "logout"]);
  });
  it("save failure retains editing session without sending logout", async () => {
    button(vi.fn().mockRejectedValue(new Error("save failed")));
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("alert");
    expect(logout).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "로그인" }),
    ).not.toBeInTheDocument();
  });
  it("logout failure stays without success navigation", async () => {
    vi.mocked(logout).mockRejectedValue(new Error("network"));
    button(vi.fn().mockResolvedValue(undefined));
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("alert");
    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "로그아웃" }),
      ).not.toBeDisabled(),
    );
  });
});
