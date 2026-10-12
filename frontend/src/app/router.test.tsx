import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRoutes } from "./router";
import { resumeSeeds } from "../../tests/fixtures/resumeSeeds";
import type { Resume } from "../domain/resume/types";

let authenticated: boolean;
let sessionFailure: boolean;
let saveFailure: boolean;
let missing: boolean;
let saved: Resume;
let calls: { path: string; method: string; body?: unknown }[];
const error = (status: number) =>
  new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: String(status),
      message: "요청을 처리하지 못했습니다.",
      field: null,
    }),
    { status },
  );
const success = (data?: unknown, meta = {}) =>
  new Response(
    JSON.stringify({
      success: true,
      meta,
      ...(data === undefined ? {} : { data }),
    }),
  );
function mount(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  authenticated = true;
  sessionFailure = false;
  saveFailure = false;
  missing = false;
  saved = structuredClone(resumeSeeds[0]);
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const body =
        typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      calls.push({ path, method, body });
      if (path === "/api/health")
        return success(undefined, {
          csrfToken: "contract-token",
          csrfHeaderName: "X-XSRF-TOKEN",
        });
      if (path === "/api/auth/me") {
        if (sessionFailure) throw new TypeError("network");
        return authenticated ? success({ nickname: "지우" }) : error(401);
      }
      if (path === "/api/auth/login" || path === "/api/auth/signup") {
        authenticated = true;
        return success();
      }
      if (!authenticated) return error(401);
      if (path === "/api/auth/logout") {
        authenticated = false;
        return success();
      }
      if (path.startsWith("/api/resumes?"))
        return success([saved], {
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        });
      if (path === `/api/resumes/${saved.id}`) {
        if (missing) return error(404);
        if (method === "PUT") {
          if (saveFailure) throw new TypeError("network");
          saved = { ...saved, ...body };
          return success();
        }
        return success(saved);
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("assembled application entry paths", () => {
  it("redirects root to the actual list and selected card to the actual editor without a second header", async () => {
    const router = mount("/");
    const links = await screen.findAllByRole("link", { name: saved.title });
    expect(router.state.location.pathname).toBe("/resumes");
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "주 메뉴" })).toBeNull();
    expect(
      calls.filter((call) => call.path === `/api/resumes/${saved.id}`),
    ).toHaveLength(0);
    fireEvent.click(links[0]);
    await screen.findByLabelText("이름");
    expect(router.state.location.pathname).toBe(`/resumes/${saved.id}/edit`);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(
      screen.getByText("지우", { selector: "header span:not(.brand)" }),
    ).toBeInTheDocument();
  });

  it.each(["/resumes", "/resumes/1/edit", "/print/1"])(
    "does not mount protected data at %s for anonymous actors",
    async (path) => {
      authenticated = false;
      const router = mount(path);
      await screen.findByRole("heading", { name: "로그인" });
      expect(router.state.location.pathname).toBe("/login");
      expect(calls.some((call) => call.path.startsWith("/api/resumes"))).toBe(
        false,
      );
      expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
      expect(screen.getByText("ResumeCraft")).not.toHaveAttribute("href");
    },
  );

  it("keeps network failure distinct from anonymous and requires retry before rendering protected data", async () => {
    sessionFailure = true;
    const router = mount("/resumes");
    await screen.findByRole("alert");
    expect(router.state.location.pathname).toBe("/resumes");
    expect(calls.some((call) => call.path.startsWith("/api/resumes"))).toBe(
      false,
    );
    sessionFailure = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: "내 이력서" });
  });

  it("connects login to signup and successful authentication to the real resume list", async () => {
    authenticated = false;
    const router = mount("/login");
    await screen.findByRole("heading", { name: "로그인" });
    fireEvent.click(screen.getByRole("link", { name: "회원가입" }));
    await screen.findByRole("heading", { name: "회원가입" });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "new@resume.dev" },
    });
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "새사용자" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password8" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "password8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(router.state.location.pathname).toBe("/resumes");
    expect(
      calls.find((call) => call.path === "/api/auth/signup")?.body,
    ).toEqual({
      email: "new@resume.dev",
      nickname: "새사용자",
      password: "password8",
    });
  });

  it.each(["/login", "/signup"])(
    "keeps an existing session and sends %s to the list",
    async (path) => {
      const router = mount(path);
      await screen.findByRole("heading", { name: "내 이력서" });
      expect(router.state.location.pathname).toBe("/resumes");
      expect(calls.some((call) => call.path === "/api/auth/logout")).toBe(
        false,
      );
    },
  );

  it("keeps missing documents on the selected route without mounting editable data", async () => {
    missing = true;
    const router = mount(`/resumes/${saved.id}/edit`);
    await screen.findByText("자료를 찾을 수 없습니다.");
    expect(router.state.location.pathname).toBe(`/resumes/${saved.id}/edit`);
    expect(screen.queryByLabelText("이름")).toBeNull();
  });

  it("mounts print without account chrome and reads the saved document through its selected id", async () => {
    mount(`/print/${saved.id}`);
    await screen.findByLabelText("A4 1페이지");
    expect(calls.some((call) => call.path === `/api/resumes/${saved.id}`)).toBe(
      true,
    );
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("flushes dirty editor data before session logout and blocks protected re-entry afterwards", async () => {
    const router = mount(`/resumes/${saved.id}/edit`);
    const name = await screen.findByLabelText("이름");
    await screen.findByRole("button", { name: "로그아웃" });
    fireEvent.change(name, { target: { value: "최신 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    const writes = calls.filter((call) => call.method !== "GET");
    expect(writes.map((call) => call.method)).toEqual(["PUT", "POST"]);
    expect(writes[1].path).toBe("/api/auth/logout");
    expect(
      saved.content[0].type === "basics" && saved.content[0].data.name,
    ).toBe("최신 이름");
    await router.navigate("/resumes");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });

  it("preserves dirty memory and authentication when the shared editor flush fails", async () => {
    saveFailure = true;
    const router = mount(`/resumes/${saved.id}/edit`);
    const name = await screen.findByLabelText("이름");
    await screen.findByRole("button", { name: "로그아웃" });
    fireEvent.change(name, { target: { value: "보존할 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(calls.some((call) => call.path === "/api/auth/logout")).toBe(false);
    expect(router.state.location.pathname).toBe(`/resumes/${saved.id}/edit`);
    expect(name).toHaveValue("보존할 이름");
    expect(authenticated).toBe(true);
  });
});
