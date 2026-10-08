import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Resume } from "../domain/resume/types";
import { ApplicationRoutes } from "./router";
import {
  authApi,
  resumeApi,
  healthApi,
  uploadPhoto,
  getPhoto,
  photoUrl,
} from "../api/apiClient";

const original: Resume = {
  id: "b957fb02-77ea-42ee-9bf4-144e7f264a59",
  title: "통합 시험 이력서",
  template: "classic",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  content: [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "시험",
        jobTitle: "개발자",
        email: "test@example.dev",
        phone: "",
        links: [],
        photoId: null,
      },
    },
  ],
};
const uploaded = "846b351b-aa98-442b-81c2-8b2e22e1f567";
let row: Resume;
let authenticated: boolean;
let offline: boolean;
let failSave: boolean;
let fetcher: ReturnType<typeof vi.fn>;
const json = (data?: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: true,
      meta: {},
      ...(data === undefined ? {} : { data }),
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
function Location() {
  return <output aria-label="현재 경로">{useLocation().pathname}</output>;
}
function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApplicationRoutes />
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  row = structuredClone(original);
  authenticated = true;
  offline = false;
  failSave = false;
  document.cookie = ["XSRF-TOKEN", "route-test"].join("=") + "; path=/";
  fetcher = vi.fn(
    async (path: string, init?: RequestInit): Promise<Response> => {
      if (path === "/api/health") return json();
      if (path === "/api/auth/login" || path === "/api/auth/signup") {
        authenticated = true;
        return json();
      }
      if (path === "/api/auth/logout") {
        authenticated = false;
        return json();
      }
      if (path === "/api/auth/me") {
        if (offline) throw new Error("offline");
        if (!authenticated)
          return new Response(
            JSON.stringify({
              success: false,
              meta: {},
              code: "UNAUTHORIZED",
              message: "로그인이 필요합니다.",
              field: null,
            }),
            { status: 401 },
          );
        return json({ nickname: "시험 사용자" });
      }
      if (path.startsWith("/api/resumes?")) return json([row]);
      if (path === "/api/resumes") return json({ id: row.id }, 201);
      if (path.startsWith("/api/resumes/")) {
        if (path.endsWith("/duplicate")) return json({ id: row.id }, 201);
        if (init?.method === "PUT") {
          if (failSave) throw new Error("save failed");
          row = { ...row, ...JSON.parse(init.body as string) };
          return json();
        }
        if (init?.method === "PATCH" || init?.method === "DELETE")
          return json();
        return json(row);
      }
      if (path === "/api/photos") return json({ photoId: uploaded }, 201);
      if (path.startsWith("/api/photos/"))
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        });
      throw new Error(`Unexpected path: ${path}`);
    },
  );
  vi.stubGlobal("fetch", fetcher);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:photo"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("application route registration", () => {
  it.each([
    "/",
    "/resumes",
    `/resumes/${original.id}/edit`,
    `/print/${original.id}`,
  ])(
    "anonymous %s reaches login without requesting protected data",
    async (path) => {
      authenticated = false;
      mount(path);
      await screen.findByRole("heading", { name: "로그인" });
      expect(screen.getByLabelText("현재 경로").textContent).toBe("/login");
      expect(
        fetcher.mock.calls.some(([url]) => url.startsWith("/api/resumes")),
      ).toBe(false);
      expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
    },
  );
  it("public login and signup links are reachable without private session requests", () => {
    mount("/login");
    fireEvent.click(screen.getByRole("link", { name: "회원가입 →" }));
    expect(screen.getByLabelText("비밀번호 확인")).toBeTruthy();
    expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("root reaches the real list and selected card reaches editor with embedded photo and style controls", async () => {
    mount();
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(screen.getByLabelText("현재 경로").textContent).toBe("/resumes");
    fireEvent.click(
      await screen.findByRole("link", { name: `${row.title} 편집` }),
    );
    await screen.findByLabelText("희망 직무");
    expect(screen.getByLabelText("사진 파일 선택")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "템플릿·스타일" }));
    expect(screen.getByLabelText("글자 크기")).toBeTruthy();
    expect(
      fetcher.mock.calls.some(([path]) => path === `/api/resumes/${row.id}`),
    ).toBe(true);
  });
  it("session lookup failure stays closed and retries instead of treating network errors as logout", async () => {
    offline = true;
    mount("/resumes");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "+ 새 이력서" })).toBeNull();
    expect(screen.getByLabelText("현재 경로").textContent).toBe("/resumes");
    offline = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: "내 이력서" });
  });
  it("logout ends the session and root re-entry cannot display private content", async () => {
    mount("/resumes");
    await screen.findByRole("heading", { name: "내 이력서" });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    fireEvent.click(
      screen.getByRole("link", { name: "ResumeCraft 이력서 목록" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("현재 경로").textContent).toBe("/login"),
    );
    expect(screen.queryByRole("heading", { name: "내 이력서" })).toBeNull();
  });
  it("print route reads server state and has no private header or editor chrome", async () => {
    mount(`/print/${row.id}`);
    await waitFor(() => expect(document.title).toBe("시험_개발자_이력서"));
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
    expect(screen.queryByRole("button", { name: "PDF 내보내기" })).toBeNull();
    expect(
      fetcher.mock.calls.some(([path]) => path === `/api/resumes/${row.id}`),
    ).toBe(true);
  });
  it("photo upload completion preserves edits made while uploading and saves via the existing queue", async () => {
    mount(`/resumes/${row.id}/edit`);
    await screen.findByLabelText("희망 직무");
    let complete!: (response: Response) => void;
    const normal = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((path: string, init?: RequestInit) =>
      path === "/api/photos"
        ? new Promise<Response>((resolve) => {
            complete = resolve;
          })
        : normal(path, init),
    );
    fireEvent.change(screen.getByLabelText("사진 파일 선택"), {
      target: {
        files: [new File(["png"], "portrait.png", { type: "image/png" })],
      },
    });
    await screen.findByText("사진 업로드 중…");
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "업로드 중 변경" },
    });
    await act(async () => {
      complete(json({ photoId: uploaded }, 201));
    });
    expect((screen.getByLabelText("희망 직무") as HTMLInputElement).value).toBe(
      "업로드 중 변경",
    );
    expect(screen.getByRole("button", { name: "변경됨" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
    await screen.findByRole("button", { name: "저장됨" });
    expect(
      row.content[0].type === "basics" && row.content[0].data.photoId,
    ).toBe(uploaded);
    expect(
      row.content[0].type === "basics" && row.content[0].data.jobTitle,
    ).toBe("업로드 중 변경");
  });
  it("failed editor save prevents logout until retry succeeds", async () => {
    mount(`/resumes/${row.id}/edit`);
    await screen.findByLabelText("희망 직무");
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "변경" },
    });
    failSave = true;
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("button", { name: "저장 실패·다시 시도" });
    expect(
      fetcher.mock.calls.some(([path]) => path === "/api/auth/logout"),
    ).toBe(false);
    failSave = false;
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    expect(
      row.content[0].type === "basics" && row.content[0].data.jobTitle,
    ).toBe("변경");
  });
});

describe("shared API registry", () => {
  it("uses existing JSON and binary adapters with selected IDs and CSRF, not new transport implementations", async () => {
    await healthApi.getHealth();
    await authApi.signup({
      email: "test@example.dev",
      nickname: "시험",
      password: "test-only-password",
    });
    await authApi.login({
      email: "test@example.dev",
      password: "test-only-password",
    });
    await authApi.getCurrentUser();
    await resumeApi.list(2, 10, "개발");
    await resumeApi.get(row.id);
    await resumeApi.create(row.title, row.template);
    await resumeApi.save(row.id, {
      template: row.template,
      style: row.style,
      content: row.content,
    });
    await resumeApi.rename(row.id, "변경된 이름");
    await resumeApi.duplicate(row.id);
    await resumeApi.remove(row.id);
    const id = await uploadPhoto(
      new File(["png"], "portrait.png", { type: "image/png" }),
    );
    expect(id).toBe(uploaded);
    expect((await getPhoto(id)).type).toBe("image/png");
    expect(photoUrl(id)).toBe(`/api/photos/${uploaded}`);
    await authApi.logout();
    expect(
      fetcher.mock.calls.some(
        ([path]) =>
          path === "/api/resumes?page=2&size=10&filter=%EA%B0%9C%EB%B0%9C",
      ),
    ).toBe(true);
    const mutations = fetcher.mock.calls.filter(
      ([, init]) => init?.method && init.method !== "GET",
    );
    expect(mutations).toHaveLength(9);
    for (const [path, init] of mutations) {
      expect(path.startsWith("/api/")).toBe(true);
      expect(init.credentials).toBe("same-origin");
      expect(init.headers.get("X-XSRF-TOKEN")).toBe("route-test");
    }
  });
});
