import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppRoutes, registeredScreens } from "./router";
import { useSessionStore } from "./session";
import { configureApiEvents } from "../shared/api";
import { Toast, useToast } from "../shared/Toast";
import type { Resume } from "../pages/resumes/model";

const transport = vi.fn();
let row: Resume;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, meta: {}, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function Location() {
  return <output aria-label="현재 경로">{useLocation().pathname}</output>;
}
function routes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes screens={registeredScreens} />
      <Location />
      <Toast />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  transport.mockReset();
  row = {
    id: "selected-resume",
    title: "지원 이력서",
    updated_at: "2026-01-01T00:00:00Z",
    template: "classic",
    style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "지우",
          jobTitle: "개발자",
          email: "user@example.org",
          phone: "",
          links: [],
          photoId: null,
        },
      },
      {
        type: "summary",
        hidden: false,
        data: { headline: "", body: "자기소개" },
      },
    ],
  };
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
    error: null,
  });
  configureApiEvents({
    unauthorized: () => useSessionStore.getState().clear(),
    error: vi.fn(),
  });
  document.cookie = `${["XSRF", "TOKEN"].join("-")}=route-token; path=/`;
  vi.stubGlobal("fetch", transport);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:uploaded-photo"),
      revokeObjectURL: vi.fn(),
    }),
  );
  transport.mockImplementation(async (path: string, init: RequestInit = {}) => {
    if (path === "/") return new Response("<!doctype html>");
    if (path === "/api/auth/me") return json({ nickname: "지우" });
    if (path.startsWith("/api/auth/"))
      return new Response(null, { status: 204 });
    if (path === "/api/photos") return json({ photoId: "uploaded-photo" }, 201);
    if (path.startsWith("/api/photos/"))
      return new Response(new Uint8Array([1, 2, 3]));
    if (path === "/api/resumes") {
      return init.method === "POST"
        ? json({ id: row.id }, 201)
        : json([structuredClone(row)]);
    }
    if (init.method === "PUT") {
      row = { ...row, ...JSON.parse(init.body as string) };
      return new Response(null, { status: 204 });
    }
    return json(structuredClone(row));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useToast.getState().dismiss();
  document.cookie = `${["XSRF", "TOKEN"].join("-")}=; Max-Age=0; path=/`;
});

it("root and product navigation lead through a selected real card to the editor", async () => {
  routes("/");
  expect(
    await screen.findByRole("heading", { name: "내 이력서" }),
  ).toBeInTheDocument();
  const menu = screen.getByRole("navigation", { name: "이력서 탐색" });
  expect(within(menu).getByRole("link", { name: "내 이력서" })).toHaveAttribute(
    "href",
    "/resumes",
  );
  expect(within(menu).getAllByRole("link")).toHaveLength(1);
  fireEvent.click(
    await screen.findByRole("link", { name: "지원 이력서 편집" }),
  );
  expect(await screen.findByLabelText("이름")).toHaveValue("지우");
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    `/resumes/${row.id}/edit`,
  );
  expect(
    transport.mock.calls.some(([path]) => path === `/api/resumes/${row.id}`),
  ).toBe(true);
});

it("anonymous protected entry and the signup link render the actual public forms", async () => {
  useSessionStore.getState().clear();
  routes("/resumes/selected-resume/edit");
  expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
  expect(transport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "회원가입" }));
  expect(screen.getByRole("heading", { name: "회원가입" })).toBeInTheDocument();
  expect(screen.getByLabelText("비밀번호 확인")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "로그아웃" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "로그인" }));
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent("/login");
});

it.each(["/login", "/signup"])(
  "authenticated %s entry renders the real list instead of a credential form",
  async (path) => {
    routes(path);
    expect(
      await screen.findByRole("link", { name: "지원 이력서 편집" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("비밀번호")).not.toBeInTheDocument();
  },
);

it("real login confirms me then enters the registered list with the same transport", async () => {
  useSessionStore.getState().clear();
  routes("/login");
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "user@example.org" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "valid-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByRole("link", { name: "지원 이력서 편집" });
  expect(transport.mock.calls.map(([path]) => path)).toEqual([
    "/api/auth/login",
    "/",
    "/api/auth/me",
    "/api/resumes",
  ]);
  expect(useSessionStore.getState().user).toEqual({ nickname: "지우" });
});

it("list creation modal returns the server-selected id to the registered editor", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "지원 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "＋ 새 이력서" }));
  const modal = within(screen.getByRole("dialog", { name: "새 이력서" }));
  fireEvent.change(modal.getByLabelText("템플릿"), {
    target: { value: "classic" },
  });
  fireEvent.click(modal.getByRole("button", { name: "생성" }));
  await screen.findByLabelText("이름");
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    `/resumes/${row.id}/edit`,
  );
});

it("list deletion modal stays on the list and cancellation never deletes", async () => {
  routes("/resumes");
  await screen.findByRole("link", { name: "지원 이력서 편집" });
  fireEvent.click(screen.getByRole("button", { name: "지원 이력서 작업" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  expect(screen.getByRole("dialog", { name: "이력서 삭제" })).toHaveTextContent(
    row.title,
  );
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent("/resumes");
  expect(
    transport.mock.calls.some(([, init]) => init.method === "DELETE"),
  ).toBe(false);
});

it("editor section and missing-fields modals use the editor route rather than new registrations", async () => {
  row.content[0].data!.jobTitle = "";
  routes(`/resumes/${row.id}/edit`);
  await screen.findByLabelText("이름");
  fireEvent.click(screen.getByRole("button", { name: "자기소개 섹션 삭제" }));
  expect(
    screen.getByRole("dialog", { name: "섹션 삭제 확인" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  expect(screen.getByRole("dialog", { name: "빠진 항목" })).toHaveTextContent(
    "희망 직무",
  );
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    `/resumes/${row.id}/edit`,
  );
  expect(screen.queryByTitle("이력서 인쇄")).not.toBeInTheDocument();
});

it("print uses the registered persisted document screen without shell or direct-tab print", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  routes(`/print/${row.id}`);
  await screen.findByText("편집기의 PDF 내보내기를 사용해 주세요.");
  expect(screen.getByRole("heading", { name: "지우" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "로그아웃" }),
  ).not.toBeInTheDocument();
  expect(print).not.toHaveBeenCalled();
});

it("photo upload callback merges the latest draft and the existing queue saves its connection", async () => {
  let finish: (value: Response) => void = () => undefined;
  const base = transport.getMockImplementation()!;
  transport.mockImplementation((path: string, init: RequestInit = {}) =>
    path === "/api/photos"
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : base(path, init),
  );
  routes(`/resumes/${row.id}/edit`);
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("사진 파일"), {
    target: {
      files: [new File(["image"], "chosen.png", { type: "image/png" })],
    },
  });
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "업로드 중 수정" },
  });
  await act(async () => finish(json({ photoId: "uploaded-photo" }, 201)));
  await screen.findByRole("button", { name: "사진 변경" });
  fireEvent.click(screen.getByRole("button", { name: "변경됨" }));
  await screen.findByRole("button", { name: "저장됨" });
  expect(row.content[0].data).toMatchObject({
    name: "업로드 중 수정",
    photoId: "uploaded-photo",
  });
  expect(
    transport.mock.calls.filter(([, init]) => init.method === "PUT"),
  ).toHaveLength(1);
});

it("editor logout waits for latest PUT before session termination and real login navigation", async () => {
  routes(`/resumes/${row.id}/edit`);
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "저장 후 종료" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await screen.findByRole("heading", { name: "로그인" });
  const writes = transport.mock.calls.filter(
    ([, init]) => init.method && init.method !== "GET",
  );
  expect(writes.map(([path, init]) => [path, init.method])).toEqual([
    [`/api/resumes/${row.id}`, "PUT"],
    ["/api/auth/logout", "POST"],
  ]);
  expect(row.content[0].data!.name).toBe("저장 후 종료");
});

it("failed editor save prevents logout and keeps the real editor draft", async () => {
  const base = transport.getMockImplementation()!;
  transport.mockImplementation((path: string, init: RequestInit = {}) =>
    init.method === "PUT"
      ? Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              meta: {},
              code: "INVALID_STRUCTURE",
              message: "저장 실패",
              field: "content",
            }),
            { status: 400 },
          ),
        )
      : base(path, init),
  );
  routes(`/resumes/${row.id}/edit`);
  await screen.findByLabelText("이름");
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "남아 있는 수정" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "저장 실패·다시 시도" }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByLabelText("이름")).toHaveValue("남아 있는 수정");
  expect(screen.getByLabelText("현재 경로")).toHaveTextContent(
    `/resumes/${row.id}/edit`,
  );
  expect(
    transport.mock.calls.some(([path]) => path === "/api/auth/logout"),
  ).toBe(false);
});
