import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Resume } from "../domain/resume/types";
import {
  clearResumeDraft,
  setResumeSessionIdentity,
} from "../pages/resumes/ResumeSession";
import { ApplicationRoutes } from "./router";

let authenticated: boolean;
let stored: Resume;
let failSave: boolean;
let requests: { path: string; method: string; body?: unknown }[];
const ok = (data?: unknown, meta: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      success: true,
      meta,
      ...(data === undefined ? {} : { data }),
    }),
  );
const error = (status: number) =>
  new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: String(status),
      message: "요청을 처리할 수 없습니다.",
      field: null,
    }),
    { status },
  );

beforeEach(() => {
  authenticated = true;
  failSave = false;
  requests = [];
  setResumeSessionIdentity(undefined);
  clearResumeDraft();
  stored = {
    id: "selected-resume",
    title: "선택한 이력서",
    template: "classic",
    style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "원래 이름",
          jobTitle: "개발자",
          email: "owner@example.org",
          phone: "",
          links: [],
          photoId: null,
        },
      },
    ],
  };
  document.cookie = ["XSRF-TOKEN", "test-token"].join("=") + "; path=/";
  vi.stubGlobal("print", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit = {}) => {
      const method = options.method ?? "GET";
      const body =
        typeof options.body === "string"
          ? JSON.parse(options.body)
          : options.body;
      requests.push({ path, method, body });
      if (path === "/api/health") return ok();
      if (path === "/api/auth/login" || path === "/api/auth/signup") {
        authenticated = true;
        return ok();
      }
      if (!authenticated) return error(401);
      if (path === "/api/auth/me") return ok({ nickname: "동일한 닉네임" });
      if (path === "/api/auth/logout") {
        authenticated = false;
        return ok();
      }
      if (path.startsWith("/api/resumes?"))
        return ok([stored], {
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        });
      if (path === "/api/resumes" && method === "POST")
        return ok({ id: stored.id });
      if (path === "/api/photos" && method === "POST")
        return ok({ photoId: "uploaded-photo" });
      if (path.startsWith("/api/photos/"))
        return new Response(new Blob(["image"], { type: "image/png" }));
      if (path === `/api/resumes/${stored.id}` && method === "GET")
        return ok(structuredClone(stored));
      if (path === `/api/resumes/${stored.id}` && method === "PUT") {
        if (failSave) return error(500);
        stored = { ...stored, ...body };
        return ok();
      }
      return error(404);
    }),
  );
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:test-photo"),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearResumeDraft();
  setResumeSessionIdentity(undefined);
});
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApplicationRoutes />
    </MemoryRouter>,
  );
}
async function login(email = "owner@example.org") {
  await screen.findByRole("heading", { name: "로그인" });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByRole("heading", { name: "내 이력서" });
}
async function openEditor() {
  fireEvent.click(
    await screen.findByRole("link", { name: /선택한 이력서 편집/ }),
  );
  await screen.findByLabelText("이름");
}

it("root alias reaches the authorized real list and selected card reaches the editor with photos", async () => {
  mount("/");
  await screen.findByRole("heading", { name: "내 이력서" });
  await openEditor();
  expect(screen.getByLabelText("사진 파일 선택")).toBeDefined();
  expect(
    requests.some((request) => request.path === `/api/resumes/${stored.id}`),
  ).toBe(true);
});

it.each([
  "/resumes",
  "/resumes/selected-resume/edit",
  "/print/selected-resume",
  "/",
])(
  "unauthenticated %s reaches login without fetching private resume data or printing",
  async (path) => {
    authenticated = false;
    mount(path);
    await screen.findByRole("heading", { name: "로그인" });
    expect(
      requests.some((request) => request.path.startsWith("/api/resumes")),
    ).toBe(false);
    expect(window.print).not.toHaveBeenCalled();
  },
);

it.each(["/login", "/signup"])(
  "authenticated %s reentry goes to the actual list",
  async (path) => {
    mount(path);
    await screen.findByRole("heading", { name: "내 이력서" });
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
  },
);

it("public login links to signup and successful signup reaches the protected list", async () => {
  authenticated = false;
  mount("/login");
  fireEvent.click(
    await screen.findByRole("link", { name: "계정이 없나요? 회원가입" }),
  );
  await screen.findByRole("heading", { name: "회원가입" });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "new@example.org" },
  });
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: "새사용자" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
    target: { value: "test-password" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  await screen.findByRole("heading", { name: "내 이력서" });
});

it("create uses the server-returned id and reaches the real editor", async () => {
  mount("/resumes");
  fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
  fireEvent.click(screen.getByRole("button", { name: "생성" }));
  await screen.findByLabelText("이름");
  expect(requests.find((request) => request.method === "POST")?.body).toEqual({
    title: "새 이력서",
    template: "classic",
  });
});

it("photo upload is injected into basics and list navigation flushes its reference through the existing PUT", async () => {
  mount("/resumes/selected-resume/edit");
  const file = await screen.findByLabelText("사진 파일 선택");
  fireEvent.change(file, {
    target: {
      files: [new File(["image"], "photo.png", { type: "image/png" })],
    },
  });
  await screen.findByText(
    "사진이 업로드되었습니다. 이력서 연결은 자동저장됩니다.",
  );
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  await screen.findByRole("heading", { name: "내 이력서" });
  expect(
    stored.content[0].type === "basics" && stored.content[0].data.photoId,
  ).toBe("uploaded-photo");
  const upload = requests.find((request) => request.path === "/api/photos");
  expect(upload?.body).toBeInstanceOf(FormData);
  expect(requests.filter((request) => request.method === "PUT")).toHaveLength(
    1,
  );
});

it("failed dirty editor logout stays on editor and never sends logout before successful flush", async () => {
  mount("/resumes/selected-resume/edit");
  fireEvent.change(await screen.findByLabelText("이름"), {
    target: { value: "미저장 이름" },
  });
  failSave = true;
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() =>
    expect(requests.some((request) => request.method === "PUT")).toBe(true),
  );
  await screen.findByRole("button", { name: "저장 실패·다시 시도" });
  expect(requests.some((request) => request.path === "/api/auth/logout")).toBe(
    false,
  );
  expect((screen.getByLabelText("이름") as HTMLInputElement).value).toBe(
    "미저장 이름",
  );
  failSave = false;
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await screen.findByRole("heading", { name: "로그인" });
  expect(
    requests.findIndex((request) => request.path === "/api/auth/logout"),
  ).toBeGreaterThan(requests.findIndex((request) => request.method === "PUT"));
});

it.each([
  ["owner@example.org", "보관한 이름"],
  ["other@example.org", "원래 이름"],
])(
  "expiry and %s re-login apply email ownership despite identical nicknames",
  async (email, expectedName) => {
    authenticated = false;
    mount("/login");
    await login();
    await openEditor();
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "보관한 이름" },
    });
    authenticated = false;
    act(() => {
      window.dispatchEvent(new Event("session-expired"));
    });
    await login(email);
    expect(screen.queryByLabelText("이름")).toBeNull();
    await openEditor();
    expect((screen.getByLabelText("이름") as HTMLInputElement).value).toBe(
      expectedName,
    );
    if (email === "owner@example.org")
      expect(screen.getByRole("button", { name: "변경됨" })).toBeDefined();
  },
);

it("authorized print loads the saved resume through its guarded route without editor chrome", async () => {
  mount("/print/selected-resume");
  await screen.findByText("원래 이름");
  await waitFor(() => expect(window.print).toHaveBeenCalledOnce());
  expect(screen.queryByRole("button", { name: "← 목록" })).toBeNull();
  expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
});

it("missing editor target keeps the generic error without exposing another resume or redirecting", async () => {
  mount("/resumes/missing/edit");
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("이름")).toBeNull();
  expect(screen.queryByRole("heading", { name: "로그인" })).toBeNull();
});
