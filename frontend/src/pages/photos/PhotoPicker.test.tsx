import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, refreshCsrf } from "../../shared/apiClient";
import { PhotoPicker } from "./PhotoPicker";
import { PhotoImage } from "./PhotoImage";
import { photoUrl } from "./api";

const originalId = "1b45b2a8-3a3e-4b83-a70c-5f185abf2030";
const uploadedId = "7be60f7b-5bc3-47a9-a363-83ca88f36052";
const failure = (status: number, code: string, message: string) =>
  new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code,
      message,
      field: "file",
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
const fetcher = vi.fn<typeof fetch>();
const createdUrl = vi.fn(() => "blob:private-photo");
const revokedUrl = vi.fn();

beforeEach(async () => {
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createdUrl;
      static revokeObjectURL = revokedUrl;
    },
  );
  fetcher.mockReset();
  fetcher.mockImplementation(async (path) => {
    if (path === "/api/health")
      return new Response(
        JSON.stringify({
          success: true,
          meta: { csrfToken: "test-token", csrfHeaderName: "X-XSRF-TOKEN" },
        }),
      );
    return new Response(new Blob(["original"], { type: "image/png" }));
  });
  await refreshCsrf();
  fetcher.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function choose(bytes = "photo", type = "image/png") {
  fireEvent.change(screen.getByLabelText("사진 파일"), {
    target: { files: [new File([bytes], "photo.png", { type })] },
  });
}

function EditorPhoto() {
  const [id, setId] = useState<string | null>(originalId);
  return <PhotoPicker photoId={id} onPhotoChange={setId} />;
}

function editorRoute() {
  return render(
    <MemoryRouter initialEntries={["/resumes/42/edit"]}>
      <Routes>
        <Route path="/resumes/:id/edit" element={<EditorPhoto />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("editor photo area", () => {
  it("is reachable inside the authorized editor route and loads the existing private photo", async () => {
    editorRoute();
    expect(
      screen.getByRole("region", { name: "기본정보 사진" }),
    ).toBeInTheDocument();
    expect(await screen.findByAltText("이력서 사진")).toHaveAttribute(
      "src",
      "blob:private-photo",
    );
    expect(fetcher).toHaveBeenCalledWith(
      photoUrl(originalId),
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );
    expect(screen.getByRole("button", { name: "변경" })).toBeInTheDocument();
  });

  it("empty state and canceled selection produce no requests or changes", () => {
    const change = vi.fn();
    render(<PhotoPicker photoId={null} onPhotoChange={change} />);
    expect(
      screen.getByRole("button", { name: "사진 등록" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("사진 파일"), {
      target: { files: [] },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it("uploads immediately with multipart file only and emits the server UUID only after success", async () => {
    const change = vi.fn();
    let finish!: (response: Response) => void;
    fetcher.mockImplementation(async (path) => {
      if (path === "/api/photos")
        return new Promise((resolve) => {
          finish = resolve;
        });
      return new Response(new Blob(["original"], { type: "image/png" }));
    });
    render(<PhotoPicker photoId={originalId} onPhotoChange={change} />);
    await screen.findByAltText("이력서 사진");
    choose();
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText("사진 파일")).toBeDisabled();
    expect(screen.getByText("사진 업로드 중…")).toBeInTheDocument();
    expect(screen.getByAltText("이력서 사진")).toBeInTheDocument();
    const upload = fetcher.mock.calls.find(([path]) => path === "/api/photos")!;
    const body = upload[1]?.body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
    expect(body.get("file")).toBeInstanceOf(File);
    expect(new Headers(upload[1]?.headers).get("Content-Type")).toBeNull();
    expect(new Headers(upload[1]?.headers).get("X-XSRF-TOKEN")).toBe(
      "test-token",
    );
    finish(
      new Response(
        JSON.stringify({
          success: true,
          meta: {},
          data: { photoId: uploadedId },
        }),
      ),
    );
    await waitFor(() => expect(change).toHaveBeenCalledWith(uploadedId));
    expect(change).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, "UNSUPPORTED_FILE_TYPE", "올바른 JPG 또는 PNG 사진을 선택해 주세요."],
    [413, "FILE_TOO_LARGE", "사진은 2MB 이하만 등록할 수 있습니다."],
    [500, "500", "요청을 처리하지 못했습니다."],
  ])(
    "failed replacement %s keeps the photo and never requests linkage PUT",
    async (status, code, message) => {
      const change = vi.fn();
      fetcher.mockImplementation(async (path) =>
        path === "/api/photos"
          ? failure(status, code, message)
          : new Response(new Blob(["original"], { type: "image/png" })),
      );
      render(<PhotoPicker photoId={originalId} onPhotoChange={change} />);
      await screen.findByAltText("이력서 사진");
      choose("invalid", "text/plain");
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(change).not.toHaveBeenCalled();
      expect(screen.getByAltText("이력서 사진")).toBeInTheDocument();
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "PUT"),
      ).toBe(false);
      vi.useFakeTimers();
      // Trigger a second failure to verify the common three-second dismissal lifecycle.
      choose();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("successful photo reference feeds the editor save boundary and survives server readback", async () => {
    let savedPhotoId: string | null = null;
    fetcher.mockImplementation(async (path, init) => {
      if (path === "/api/photos") {
        return new Response(
          JSON.stringify({
            success: true,
            meta: {},
            data: { photoId: uploadedId },
          }),
        );
      }
      if (path === "/api/resumes/42" && init?.method === "PUT") {
        savedPhotoId = JSON.parse(init.body as string).content[0].data.photoId;
        return new Response(JSON.stringify({ success: true, meta: {} }));
      }
      if (path === "/api/resumes/42") {
        return new Response(
          JSON.stringify({
            success: true,
            meta: {},
            data: {
              content: [
                {
                  type: "basics",
                  hidden: false,
                  data: { photoId: savedPhotoId },
                },
              ],
            },
          }),
        );
      }
      return new Response(new Blob(["original"], { type: "image/png" }));
    });
    // Parent-owned queue adapter: component emits a memory edit; it must not create a second PUT queue.
    const change = vi.fn((id: string | null) => {
      void apiClient.put("/api/resumes/42", {
        template: "classic",
        style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
        content: [{ type: "basics", hidden: false, data: { photoId: id } }],
      });
    });
    render(<PhotoPicker photoId={null} onPhotoChange={change} />);
    choose();
    await waitFor(() => expect(savedPhotoId).toBe(uploadedId));
    const result = await apiClient.get<{
      content: { data: { photoId: string } }[];
    }>("/api/resumes/42");
    expect(result.data?.content[0].data.photoId).toBe(uploadedId);
  });

  it("remove clears only the logical reference without deleting photo data", async () => {
    const change = vi.fn();
    render(<PhotoPicker photoId={originalId} onPhotoChange={change} />);
    await screen.findByAltText("이력서 사진");
    fireEvent.click(screen.getByRole("button", { name: "사진 삭제" }));
    expect(change).toHaveBeenCalledWith(null);
    expect(change).toHaveBeenCalledTimes(1);
    expect(
      fetcher.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
  });

  it("read-only state blocks select, change and unlink controls", () => {
    render(
      <PhotoPicker photoId={originalId} onPhotoChange={vi.fn()} disabled />,
    );
    expect(screen.getByLabelText("사진 파일")).toBeDisabled();
    expect(screen.getByRole("button", { name: "변경" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "사진 삭제" })).toBeDisabled();
  });

  it("upload 401 navigates to login without emitting a replacement", async () => {
    const login = vi.fn();
    const change = vi.fn();
    fetcher.mockResolvedValue(failure(401, "401", "로그인이 필요합니다."));
    render(
      <PhotoPicker
        photoId={null}
        onPhotoChange={change}
        onUnauthorized={login}
      />,
    );
    choose();
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(change).not.toHaveBeenCalled();
  });

  it("missing private image exposes no bytes and releases blob URLs on unmount", async () => {
    fetcher.mockResolvedValue(failure(404, "404", "찾을 수 없습니다."));
    const view = render(<PhotoImage photoId={originalId} />);
    expect(
      await screen.findByText("사진을 표시할 수 없습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    view.unmount();
    fetcher.mockResolvedValue(
      new Response(new Blob(["original"], { type: "image/png" })),
    );
    const loaded = render(<PhotoImage photoId={uploadedId} />);
    await screen.findByAltText("이력서 사진");
    loaded.unmount();
    expect(revokedUrl).toHaveBeenCalledWith("blob:private-photo");
  });
});
