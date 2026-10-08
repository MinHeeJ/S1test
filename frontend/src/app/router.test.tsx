import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApplicationRoutes } from "./router";
import { apiClient, AuthApiError, ResumeApiError } from "../api/apiClient";
import { resumeFixture } from "../../tests/fixtures/resumeSeeds";
import type { Resume, UpdateResumeInput } from "../domain/resume/types";

const transport = vi.fn<typeof fetch>();
let authenticated: boolean;
let saved: Resume;
let requests: { path: string; init?: RequestInit }[];
let upload: (() => Promise<Response>) | undefined;
let saveFailure: boolean;
let photoFailure: boolean;

function json(data?: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      meta: {},
      ...(data === undefined ? {} : { data }),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "test-token",
        "X-CSRF-HEADER": "X-CSRF-TOKEN",
      },
    },
  );
}
function error(status: number) {
  return new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: "Unauthorized",
      message: "요청 실패",
    }),
    {
      status,
      headers: { "X-CSRF-TOKEN": "test-token" },
    },
  );
}
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApplicationRoutes />
    </MemoryRouter>,
  );
}
function basics() {
  const section = saved.content.find((section) => section.type === "basics");
  if (!section) throw new Error("Missing fixture basics");
  return section;
}
beforeEach(() => {
  authenticated = true;
  saved = resumeFixture();
  saved.content = [saved.content[0]];
  basics().data.name = "지우";
  basics().data.jobTitle = "개발자";
  basics().data.email = "jiwoo@resume.dev";
  requests = [];
  upload = undefined;
  saveFailure = false;
  photoFailure = false;
  transport.mockReset();
  transport.mockImplementation(async (input, init) => {
    const path = String(input);
    requests.push({ path, init });
    if (path === "/api/auth/me")
      return authenticated ? json({ nickname: "지우" }) : error(401);
    if (path === "/api/auth/login" || path === "/api/auth/signup") {
      authenticated = true;
      return json();
    }
    if (!authenticated) return error(401);
    if (path === "/api/auth/logout") {
      authenticated = false;
      return json();
    }
    if (path.startsWith("/api/resumes?")) return json([saved]);
    if (path === "/api/photos")
      return upload ? upload() : json({ photoId: "uploaded-photo" }, 201);
    if (path.startsWith("/api/photos/")) {
      return photoFailure
        ? error(404)
        : new Response(new Blob(["image"], { type: "image/png" }));
    }
    if (path === "/api/resumes" && init?.method === "POST")
      return json({ id: saved.id }, 201);
    if (path.endsWith("/duplicate")) return json({ id: "copy-id" }, 201);
    if (path === `/api/resumes/${saved.id}`) {
      if (init?.method === "PUT") {
        if (saveFailure) return error(500);
        const update = JSON.parse(init.body as string) as UpdateResumeInput;
        saved = {
          ...saved,
          template: update.template,
          style: update.style,
          content: update.content,
          title: update.title ?? saved.title,
        };
        return json();
      }
      if (init?.method === "PATCH" || init?.method === "DELETE") return json();
      return json(saved);
    }
    return error(404);
  });
  vi.stubGlobal("fetch", transport);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(window, "print").mockImplementation(() => undefined);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:photo"),
      revokeObjectURL: vi.fn(),
    }),
  );
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("실제 앱 route 및 세션 경계", () => {
  it.each(["/login", "/signup"])(
    "공개 %s는 보호 자료를 요청하지 않는다",
    (path) => {
      authenticated = false;
      mount(path);
      expect(
        screen.getByRole("heading", {
          name: path === "/login" ? "로그인" : "회원가입",
        }),
      ).toBeTruthy();
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it.each(["/", "/resumes", "/resumes/private/edit", "/print/private"])(
    "무세션 %s는 로그인으로 이동한다",
    async (path) => {
      authenticated = false;
      mount(path);
      await screen.findByRole("heading", { name: "로그인" });
      expect(requests.every((request) => request.path === "/api/auth/me")).toBe(
        true,
      );
      expect(screen.queryByText("지우")).toBeNull();
    },
  );
  it("세션 확인 네트워크 실패는 보호 데이터를 노출하지 않고 재시도한다", async () => {
    transport.mockRejectedValueOnce(new TypeError("network"));
    mount("/resumes");
    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: "내 이력서" });
  });
  it("로그인 후 실제 목록·카드·편집기와 한 개의 shell에 도달한다", async () => {
    authenticated = false;
    mount("/login");
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "jiwoo@resume.dev" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "demo1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    fireEvent.click(
      await screen.findByRole("link", { name: `${saved.title} 편집` }),
    );
    await screen.findByLabelText("희망 직무");
    expect(document.querySelectorAll(".resume-shell").length).toBe(1);
    expect(screen.getByRole("region", { name: "기본정보 사진" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /내 이력서/ }).getAttribute("href"),
    ).toBe("/resumes");
  });
  it("루트 별칭은 실제 목록으로 연결된다", async () => {
    mount("/");
    await screen.findByRole("heading", { name: "내 이력서" });
  });
  it("생성 모달의 서버 id로 실제 편집기가 열린다", async () => {
    mount("/resumes");
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 이력서" }));
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    await screen.findByLabelText("희망 직무");
    expect(
      requests.some((request) => request.path === `/api/resumes/${saved.id}`),
    ).toBe(true);
  });
  it("로그아웃 후 닉네임과 보호 화면이 제거된다", async () => {
    mount("/resumes");
    await screen.findByText("지우", { selector: "footer span" });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByRole("heading", { name: "로그인" });
    expect(screen.queryByText("지우")).toBeNull();
    expect(authenticated).toBe(false);
  });
});

describe("사진·자동저장·서버 재조회 통합", () => {
  it("업로드 중 최신 입력을 보존하고 단일 큐로 저장 후 GET에서 photoId가 일치한다", async () => {
    let complete!: (response: Response) => void;
    upload = () =>
      new Promise((resolve) => {
        complete = resolve;
      });
    mount(`/resumes/${saved.id}/edit`);
    await screen.findByLabelText("희망 직무");
    fireEvent.change(screen.getByLabelText("사진 파일"), {
      target: {
        files: [new File(["image"], "photo.png", { type: "image/png" })],
      },
    });
    await waitFor(() => expect(complete).toBeDefined());
    fireEvent.change(screen.getByLabelText("희망 직무"), {
      target: { value: "최신 입력" },
    });
    await act(async () => {
      complete(json({ photoId: "uploaded-photo" }, 201));
    });
    await screen.findByRole("button", { name: "사진 삭제" });
    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
    await screen.findByRole("heading", { name: "내 이력서" });
    const readback = await apiClient.resumes.get(saved.id);
    expect(readback.content[0]).toMatchObject({
      data: { photoId: "uploaded-photo", jobTitle: "최신 입력" },
    });
    expect(
      requests.filter((request) => request.init?.method === "PUT").length,
    ).toBe(1);
  });
  it("저장 실패는 로그아웃과 이동을 막고 입력을 유지한다", async () => {
    saveFailure = true;
    mount(`/resumes/${saved.id}/edit`);
    fireEvent.change(await screen.findByLabelText("희망 직무"), {
      target: { value: "수정 중" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await screen.findByText("저장 실패·다시 시도");
    expect(
      requests.some((request) => request.path === "/api/auth/logout"),
    ).toBe(false);
    expect((screen.getByLabelText("희망 직무") as HTMLInputElement).value).toBe(
      "수정 중",
    );
  });
  it("서버 인쇄는 사진 blob 로딩 완료까지 기다리고 shell 없이 출력한다", async () => {
    basics().data.photoId = "print-photo";
    let complete!: (response: Response) => void;
    const regular = transport.getMockImplementation()!;
    transport.mockImplementation((input, init) =>
      String(input).startsWith("/api/photos/")
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : regular(input, init),
    );
    mount(`/print/${saved.id}`);
    await waitFor(() => expect(complete).toBeDefined());
    expect(window.print).not.toHaveBeenCalled();
    transport.mockImplementation(regular);
    await act(async () => {
      complete(new Response(new Blob(["image"])));
    });
    await waitFor(() => expect(window.print).toHaveBeenCalled());
    expect(document.querySelector(".resume-shell")).toBeNull();
  });
  it("사진 조회 실패는 불완전한 PDF를 인쇄하지 않는다", async () => {
    basics().data.photoId = "missing-photo";
    photoFailure = true;
    mount(`/print/${saved.id}`);
    await screen.findByText("인쇄 준비에 실패했습니다.");
    expect(window.print).not.toHaveBeenCalled();
  });
});

describe("공유 client 등록은 실제 feature 구현을 사용한다", () => {
  it("변이는 /me CSRF와 쿠키를 전달하고 선택된 id를 사용한다", async () => {
    await apiClient.resumes.create("제목", "classic");
    await apiClient.resumes.rename(saved.id, "이름");
    await apiClient.resumes.duplicate(saved.id);
    await apiClient.resumes.save(saved.id, {
      template: saved.template,
      style: saved.style,
      content: saved.content,
    });
    await apiClient.resumes.remove(saved.id);
    await apiClient.photos.uploadPhoto(
      new File(["image"], "photo.png", { type: "image/png" }),
    );
    const mutations = requests.filter(
      (request) => request.init?.method && request.init.method !== "GET",
    );
    expect(mutations.length).toBe(6);
    for (const { init } of mutations) {
      expect(init?.credentials).toBe("same-origin");
      expect(new Headers(init?.headers).get("X-CSRF-TOKEN")).toBe("test-token");
    }
    expect(apiClient.photos.photoPath("selected/id")).toBe(
      "/api/photos/selected%2Fid",
    );
  });
  it("flat 오류 status와 field를 보존하고 성공 값을 만들지 않는다", async () => {
    authenticated = false;
    await expect(apiClient.auth.getCurrentUser()).rejects.toBeInstanceOf(
      AuthApiError,
    );
    await expect(apiClient.resumes.get(saved.id)).rejects.toBeInstanceOf(
      ResumeApiError,
    );
  });
});
