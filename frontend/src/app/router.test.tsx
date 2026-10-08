import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useRoutes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Resume } from "../domain/resume/types";
import { resumeSeeds } from "../../tests/fixtures/resumeSeeds";
import { applicationApi, applicationRoutes } from "./router";

const reply = (status: number, data?: unknown, meta = {}) =>
  new Response(
    JSON.stringify(
      status < 400
        ? { success: true, meta, ...(data === undefined ? {} : { data }) }
        : {
            success: false,
            meta: {},
            code: status === 401 ? "UNAUTHORIZED" : "NOT_FOUND",
            message:
              status === 401 ? "로그인이 필요합니다." : "찾을 수 없습니다.",
            field: null,
          },
    ),
    { status, headers: { "X-CSRF-TOKEN": "route-csrf" } },
  );
let authenticated: boolean;
let row: Resume;
let fetcher: ReturnType<typeof vi.fn>;
function RouteView() {
  return useRoutes(applicationRoutes);
}
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteView />
    </MemoryRouter>,
  );
}
const calledPaths = () => fetcher.mock.calls.map(([path]) => String(path));

beforeEach(() => {
  authenticated = true;
  row = {
    ...structuredClone(resumeSeeds[1]),
    id: crypto.randomUUID(),
  } as unknown as Resume;
  fetcher = vi.fn(async (input: string, options?: RequestInit) => {
    const url = new URL(input, "http://test.invalid");
    const method = options?.method ?? "GET";
    if (url.pathname === "/api/auth/me")
      return reply(authenticated ? 200 : 401, { nickname: "지우" });
    if (
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/signup"
    ) {
      authenticated = true;
      return reply(url.pathname.endsWith("signup") ? 201 : 200);
    }
    if (url.pathname === "/api/auth/logout") {
      authenticated = false;
      return reply(200);
    }
    if (!authenticated) return reply(401);
    if (url.pathname === "/api/resumes") {
      return method === "POST"
        ? reply(201, { id: row.id })
        : reply(200, [row], { total: 1 });
    }
    if (url.pathname === `/api/resumes/${row.id}`)
      return reply(200, method === "GET" ? row : undefined);
    if (url.pathname === `/api/resumes/${row.id}/duplicate`)
      return reply(201, { id: crypto.randomUUID() });
    if (url.pathname === "/api/photos")
      return reply(201, { photoId: crypto.randomUUID() });
    if (url.pathname.startsWith("/api/photos/"))
      return new Response("image-bytes", {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    return reply(404);
  });
  vi.stubGlobal("fetch", fetcher);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("실제 등록 route의 진입과 세션 경계", () => {
  it("로그인된 root는 목록·서버 nickname을 표시한다", async () => {
    mount("/");
    expect(await screen.findByRole("link", { name: row.title })).toBeVisible();
    expect(within(screen.getByRole("banner")).getByText("지우")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /인쇄|PDF/ }),
    ).not.toBeInTheDocument();
  });

  it("무세션 root는 보호 API나 목록을 마운트하지 않고 로그인으로 이동한다", async () => {
    authenticated = false;
    mount("/");
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(calledPaths().every((path) => path === "/api/auth/me")).toBe(true);
    expect(
      screen.queryByRole("button", { name: "로그아웃" }),
    ).not.toBeInTheDocument();
  });

  it("무세션 편집 직접 진입은 이력서 GET 없이 로그인한다", async () => {
    authenticated = false;
    mount(`/resumes/${row.id}/edit`);
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(calledPaths()).not.toContain(`/api/resumes/${row.id}`);
    expect(screen.queryByLabelText("희망 직무")).not.toBeInTheDocument();
  });

  it("공개 화면의 회원가입·로그인 링크는 실제 폼으로 이동한다", async () => {
    authenticated = false;
    mount("/login");
    await screen.findByRole("heading", { name: "로그인" });
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "계정 접근" })).getByRole(
        "link",
        { name: "회원가입" },
      ),
    );
    expect(await screen.findByLabelText("비밀번호 확인")).toBeVisible();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "계정 접근" })).getByRole(
        "link",
        { name: "로그인" },
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(screen.queryByText("지우")).not.toBeInTheDocument();
  });

  it("로그인된 사용자의 /login 재진입은 목록으로 이동한다", async () => {
    mount("/login");
    expect(
      await screen.findByRole("heading", { name: "나의 이력서" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("비밀번호")).not.toBeInTheDocument();
  });

  it("로그인된 사용자의 /signup 재진입은 목록으로 이동한다", async () => {
    mount("/signup");
    expect(
      await screen.findByRole("heading", { name: "나의 이력서" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("비밀번호 확인")).not.toBeInTheDocument();
  });

  it("로그인 성공은 실제 목록에 도달하며 선택한 카드의 id로 편집한다", async () => {
    authenticated = false;
    mount("/login");
    await screen.findByRole("heading", { name: "로그인" });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "fixture@resume.dev" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "fixture-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    fireEvent.click(await screen.findByRole("link", { name: row.title }));
    expect(await screen.findByLabelText("희망 직무")).toHaveValue(
      "백엔드 개발자",
    );
    expect(calledPaths()).toContain(`/api/resumes/${row.id}`);
    expect(screen.getByLabelText("사진 파일")).toBeInTheDocument();
  });

  it("생성 모달은 서버의 새 id로 편집 route에 도달한다", async () => {
    mount("/resumes");
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "새 이력서" })).getByRole(
        "button",
        { name: "생성" },
      ),
    );
    expect(await screen.findByLabelText("희망 직무")).toBeVisible();
    expect(calledPaths()).toContain(`/api/resumes/${row.id}`);
  });

  it("session 조회 실패는 재시도 가능하며 보호 화면을 노출하지 않는다", async () => {
    fetcher.mockRejectedValueOnce(new Error("offline"));
    mount("/resumes");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "세션을 확인할 수 없습니다.",
    );
    expect(
      screen.queryByRole("heading", { name: "나의 이력서" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("link", { name: row.title })).toBeVisible();
  });

  it("무세션 print는 로그인하며 저장본 GET 또는 print를 실행하지 않는다", async () => {
    authenticated = false;
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    mount(`/print/${row.id}`);
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(calledPaths()).not.toContain(`/api/resumes/${row.id}`);
    expect(print).not.toHaveBeenCalled();
  });

  it("top-level print는 iframe 전용 안내이고 header나 인쇄 메뉴가 없다", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    mount(`/print/${row.id}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF 내보내기");
    expect(
      screen.queryByRole("link", { name: "ResumeCraft" }),
    ).not.toBeInTheDocument();
    expect(calledPaths()).not.toContain(`/api/resumes/${row.id}`);
    expect(print).not.toHaveBeenCalled();
  });

  it("편집 중 보호401은 미저장 안내 뒤 실제 로그인 폼으로 이동한다", async () => {
    const notice = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);
    mount(`/resumes/${row.id}/edit`);
    await screen.findByLabelText("희망 직무");
    authenticated = false;
    await act(async () => {
      await expect(applicationApi.resumes.get(row.id)).rejects.toMatchObject({
        status: 401,
      });
    });
    expect(notice).toHaveBeenCalledWith(
      expect.stringContaining("미저장 변경이 반영되지 않았습니다."),
    );
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("희망 직무")).not.toBeInTheDocument();
  });

  it("편집의 로그아웃은 PUT 완료 후 실행되고 로그인으로 이동한다", async () => {
    mount(`/resumes/${row.id}/edit`);
    fireEvent.change(await screen.findByLabelText("이름"), {
      target: { value: "변경된 이름" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(
      await screen.findByRole("heading", { name: "로그인" }),
    ).toBeVisible();
    const writes = fetcher.mock.calls.filter(
      ([, options]) => options?.method && options.method !== "GET",
    );
    expect(writes.map(([path, options]) => [path, options.method])).toEqual([
      [`/api/resumes/${row.id}`, "PUT"],
      ["/api/auth/logout", "POST"],
    ]);
    expect(JSON.parse(writes[0][1].body).content[0].data.name).toBe(
      "변경된 이름",
    );
  });
});

describe("상위 registry는 feature-local API를 공유 transport에 단방향 연결한다", () => {
  it("선택한 이력서의 PATCH/복제/DELETE를 등록 client로 전달한다", async () => {
    await applicationApi.auth.me();
    await applicationApi.resumes.rename(row.id, "변경");
    await applicationApi.resumes.duplicate(row.id);
    await applicationApi.resumes.delete(row.id);
    const writes = fetcher.mock.calls.filter(
      ([, options]) => options?.method !== "GET",
    );
    expect(writes.map(([path, options]) => [path, options.method])).toEqual([
      [`/api/resumes/${row.id}`, "PATCH"],
      [`/api/resumes/${row.id}/duplicate`, "POST"],
      [`/api/resumes/${row.id}`, "DELETE"],
    ]);
    expect(JSON.parse(writes[0][1].body)).toEqual({ title: "변경" });
    expect(
      writes.every(
        ([, options]) =>
          new Headers(options.headers).get("X-CSRF-TOKEN") === "route-csrf",
      ),
    ).toBe(true);
  });

  it("선택한 파일 업로드와 응답 photoId의 바이너리 GET을 연결한다", async () => {
    const file = new File(["content"], "photo.png", { type: "image/png" });
    const photoId = await applicationApi.photos.uploadPhoto(file);
    const blob = await applicationApi.photos.getPhoto(photoId);
    expect(blob.type).toBe("image/png");
    expect(applicationApi.photos.photoUrl(photoId)).toBe(
      `/api/photos/${photoId}`,
    );
    const upload = fetcher.mock.calls.find(([path]) => path === "/api/photos")!;
    expect(upload[1].body.get("file")).toBe(file);
    expect(new Headers(upload[1].headers).has("Content-Type")).toBe(false);
    await waitFor(() =>
      expect(calledPaths()).toContain(`/api/photos/${photoId}`),
    );
  });
});
