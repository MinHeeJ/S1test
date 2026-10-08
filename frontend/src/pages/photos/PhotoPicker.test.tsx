import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { PhotoPicker } from "./PhotoPicker";
import type { Resume } from "../../domain/resume/types";
import { apiClient, setUnauthorizedHandler } from "../../api/apiClient";

const original = crypto.randomUUID();
const replacement = crypto.randomUUID();
const resumeId = crypto.randomUUID();
const resume: Resume = {
  id: resumeId,
  title: "사진 시험",
  template: "classic",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  content: [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "",
        jobTitle: "",
        email: "",
        phone: "",
        links: [],
        photoId: original,
      },
    },
  ],
};
function response(status: number, data: unknown, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers });
}
let fetcher: ReturnType<typeof vi.fn>;
let stored: Resume;
beforeEach(() => {
  stored = structuredClone(resume);
  vi.stubGlobal(
    "fetch",
    (fetcher = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/api/auth/me")
        return response(200, {}, { "X-CSRF-TOKEN": "photo-csrf" });
      if (path === "/api/photos")
        return response(201, {
          success: true,
          meta: {},
          data: { photoId: replacement },
        });
      if (path.startsWith("/api/photos/"))
        return new Response(new Blob(["original"], { type: "image/png" }));
      if (options?.method === "PUT") {
        stored = { ...stored, ...JSON.parse(String(options.body)) };
        return response(200, { success: true, meta: {} });
      }
      return response(200, { success: true, meta: {}, data: stored });
    })),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:photo");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Editor({ changed }: { changed: (id: string | null) => void }) {
  const [id, setId] = useState<string | null>(original);
  return (
    <PhotoPicker
      photoId={id}
      onPhotoChange={(next) => {
        setId(next);
        changed(next);
      }}
    />
  );
}
function choose() {
  fireEvent.change(screen.getByLabelText("사진 파일"), {
    target: {
      files: [new File(["photo"], "portrait.png", { type: "image/png" })],
    },
  });
}

describe("편집기 사진 영역", () => {
  it("기존 edit route에서 선택 즉시 업로드하고 전체 저장 callback 후 GET 연결을 확인한다", async () => {
    const changed = vi.fn((id: string | null) => {
      const content = structuredClone(stored.content);
      const basics = content.find((section) => section.type === "basics");
      if (basics?.type === "basics") basics.data.photoId = id;
      void apiClient.put(`/api/resumes/${stored.id}`, {
        title: stored.title,
        template: stored.template,
        style: stored.style,
        content,
      });
    });
    render(
      <MemoryRouter initialEntries={[`/resumes/${resumeId}/edit`]}>
        <Routes>
          <Route
            path="/resumes/:id/edit"
            element={<Editor changed={changed} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByAltText("이력서 사진");
    choose();
    await waitFor(() => expect(changed).toHaveBeenCalledWith(replacement));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, options]) => options?.method === "PUT"),
      ).toBe(true),
    );
    const saved = await apiClient.get<Resume>(`/api/resumes/${resumeId}`);
    const basics = saved.data?.content.find(
      (section) => section.type === "basics",
    );
    expect(basics?.type === "basics" && basics.data.photoId).toBe(replacement);
    const upload = fetcher.mock.calls.find(([path]) => path === "/api/photos");
    expect(upload?.[1]?.body).toBeInstanceOf(FormData);
    expect((upload?.[1]?.body as FormData).get("file")).toBeInstanceOf(File);
    expect((upload?.[1]?.body as FormData).has("resume_id")).toBe(false);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "사진이 등록되었습니다",
    );
  });

  it.each([
    [400, "UNSUPPORTED_FILE_TYPE"],
    [413, "FILE_TOO_LARGE"],
    [500, "INTERNAL_SERVER_ERROR"],
  ])(
    "업로드 %s 실패는 기존 사진을 유지하고 참조 변경 및 PUT을 하지 않는다",
    async (status, code) => {
      const implementation = fetcher.getMockImplementation()!;
      fetcher.mockImplementation((path, options) =>
        path === "/api/photos"
          ? Promise.resolve(
              response(status, {
                success: false,
                meta: {},
                code,
                message: "업로드 실패",
                field: "file",
              }),
            )
          : implementation(path, options),
      );
      const changed = vi.fn();
      render(<Editor changed={changed} />);
      await screen.findByAltText("이력서 사진");
      choose();
      expect(await screen.findByRole("alert")).toHaveTextContent("업로드 실패");
      expect(screen.getByAltText("이력서 사진")).toBeVisible();
      expect(changed).not.toHaveBeenCalled();
      expect(
        fetcher.mock.calls.some(([, options]) => options?.method === "PUT"),
      ).toBe(false);
    },
  );

  it("사진 없음은 이미지 요청 없이 안내하고 파일 선택 취소는 POST하지 않는다", () => {
    const changed = vi.fn();
    render(<PhotoPicker photoId={null} onPhotoChange={changed} />);
    expect(screen.getByText("사진 등록")).toBeVisible();
    expect(screen.getByText(/JPG·PNG/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("사진 파일"), {
      target: { files: [] },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("업로드 중 기존 사진을 유지하고 중복 선택을 차단한다", async () => {
    const implementation = fetcher.getMockImplementation()!;
    let complete!: (response: Response) => void;
    fetcher.mockImplementation((path, options) =>
      path === "/api/photos"
        ? new Promise<Response>((resolve) => {
            complete = resolve;
          })
        : implementation(path, options),
    );
    const changed = vi.fn();
    render(<Editor changed={changed} />);
    await screen.findByAltText("이력서 사진");
    choose();
    await screen.findByText("사진 업로드 중…");
    expect(screen.getByAltText("이력서 사진")).toBeVisible();
    expect(screen.getByRole("button", { name: "변경" })).toBeDisabled();
    expect(changed).not.toHaveBeenCalled();
    await act(async () =>
      complete(
        response(201, {
          success: true,
          meta: {},
          data: { photoId: replacement },
        }),
      ),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });

  it("삭제는 null callback만 전달하고 사진 DELETE 요청은 없다", async () => {
    const changed = vi.fn();
    render(<Editor changed={changed} />);
    await screen.findByAltText("이력서 사진");
    fireEvent.click(screen.getByRole("button", { name: "사진 삭제" }));
    expect(changed).toHaveBeenCalledWith(null);
    expect(screen.queryByAltText("이력서 사진")).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([, options]) => options?.method === "DELETE"),
    ).toBe(false);
  });

  it("사진 404는 이미지와 타인 정보 없이 오류만 표시한다", async () => {
    fetcher.mockResolvedValue(
      response(404, {
        success: false,
        meta: {},
        code: "NOT_FOUND",
        message: "찾을 수 없습니다.",
        field: null,
      }),
    );
    render(<PhotoPicker photoId={original} onPhotoChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "사진을 표시할 수 없습니다",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("접근 차단 상태에는 변경과 삭제를 실행할 수 없다", () => {
    render(<PhotoPicker photoId={original} onPhotoChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "변경" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "사진 삭제" })).toBeDisabled();
  });

  it("보호 업로드401은 공통 로그인 이동을 호출하고 참조를 바꾸지 않는다", async () => {
    const implementation = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((path, options) =>
      path === "/api/photos"
        ? Promise.resolve(
            response(401, {
              success: false,
              meta: {},
              code: "UNAUTHORIZED",
              message: "로그인이 필요합니다.",
              field: null,
            }),
          )
        : implementation(path, options),
    );
    const redirect = vi.fn();
    setUnauthorizedHandler(redirect);
    const changed = vi.fn();
    render(<Editor changed={changed} />);
    choose();
    await screen.findByRole("alert");
    expect(redirect).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
  });
});
