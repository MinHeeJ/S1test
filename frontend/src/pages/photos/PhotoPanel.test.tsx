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
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhotoPanel } from "./PhotoPanel";
import { apiRequest } from "../../shared/apiClient";
import { photoUrl } from "./photoApi";
import type { ResumeContent } from "../../domain/resume/types";

const originalId = "b59fbdc5-9c27-41bc-884e-cc6969547749";
const uploadedId = "a74ae509-1eab-4d78-a715-897bd87e4c34";
let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.cookie = "XSRF-TOKEN=photo-test";
  fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(new Blob(["original"], { type: "image/png" })),
    );
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:photo"),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function choose(file?: File) {
  fireEvent.change(screen.getByLabelText("사진 파일 선택"), {
    target: { files: file ? [file] : [] },
  });
}
function uploadResponse() {
  return new Response(
    JSON.stringify({ success: true, meta: {}, data: { photoId: uploadedId } }),
  );
}

it("authorized editor route renders its photo fragment without creating a separate photo route", () => {
  render(
    <MemoryRouter initialEntries={["/resumes/selected/edit"]}>
      <Routes>
        <Route
          path="/resumes/:id/edit"
          element={<PhotoPanel photoId={null} onPhotoChange={vi.fn()} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("button", { name: /사진 등록/ })).toBeDefined();
  expect(
    (screen.getByRole("button", { name: "사진 삭제" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});

it("uploads multipart file immediately with CSRF then passes only the returned ID to the editor queue", async () => {
  fetcher.mockResolvedValueOnce(uploadResponse());
  const changed = vi.fn();
  render(<PhotoPanel photoId={null} onPhotoChange={changed} />);
  const file = new File(["png bytes"], "portrait.png", { type: "image/png" });
  choose(file);
  await waitFor(() => expect(changed).toHaveBeenCalledWith(uploadedId));
  const [path, request] = fetcher.mock.calls[0];
  expect(path).toBe("/api/photos");
  expect(request.method).toBe("POST");
  expect(request.body.get("file")).toBe(file);
  expect([...request.body.keys()]).toEqual(["file"]);
  expect(request.headers.get("X-XSRF-TOKEN")).toBe("photo-test");
  expect(request.headers.has("Content-Type")).toBe(false);
  expect(screen.getByText(/이력서 연결은 자동저장/)).toBeDefined();
});

it("consumer saves returned photoId in full content then server readback keeps the same UUID", async () => {
  let saved: ResumeContent | undefined;
  fetcher.mockImplementation(async (path: string, request?: RequestInit) => {
    if (path === "/api/photos") return uploadResponse();
    if (request?.method === "PUT") {
      saved = JSON.parse(String(request.body)).content;
      return new Response(JSON.stringify({ success: true, meta: {} }));
    }
    if (path === "/api/resumes/selected") {
      return new Response(
        JSON.stringify({ success: true, meta: {}, data: { content: saved } }),
      );
    }
    return new Response(new Blob(["photo"], { type: "image/png" }));
  });
  const content: ResumeContent = [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "",
        jobTitle: "",
        email: "",
        phone: "",
        links: [],
        photoId: null,
      },
    },
  ];
  const changed = vi.fn(async (photoId: string | null) => {
    const next = content.map((section) =>
      section.type === "basics"
        ? { ...section, data: { ...section.data, photoId } }
        : section,
    );
    await apiRequest("/api/resumes/selected", {
      method: "PUT",
      body: JSON.stringify({
        template: "classic",
        style: {
          color: "#1F3A5F",
          font: "pretendard",
          size: "medium",
        },
        content: next,
      }),
    });
  });
  render(<PhotoPanel photoId={null} onPhotoChange={changed} />);
  choose(new File(["png"], "portrait.png", { type: "image/png" }));
  await waitFor(() =>
    expect(saved?.[0].type === "basics" && saved[0].data.photoId).toBe(
      uploadedId,
    ),
  );
  const result = await apiRequest<{ content: ResumeContent }>(
    "/api/resumes/selected",
  );
  expect(result.data.content).toEqual(saved);
});

it("keeps original photo visible and all choices disabled until one upload completes", async () => {
  render(<PhotoPanel photoId={originalId} onPhotoChange={vi.fn()} />);
  await screen.findByRole("img");
  let finish!: (response: Response) => void;
  fetcher.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  choose(new File(["png"], "new.png", { type: "image/png" }));
  expect(screen.getByRole("img")).toBeDefined();
  expect(
    (screen.getByLabelText("사진 파일 선택") as HTMLInputElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "사진 삭제" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  choose(new File(["png"], "duplicate.png", { type: "image/png" }));
  expect(
    fetcher.mock.calls.filter(([path]) => path === "/api/photos"),
  ).toHaveLength(1);
  finish(uploadResponse());
  await waitFor(() =>
    expect(
      (screen.getByLabelText("사진 파일 선택") as HTMLInputElement).disabled,
    ).toBe(false),
  );
});

it("unsupported local file keeps original reference and image without uploading or scheduling PUT", async () => {
  const changed = vi.fn();
  render(<PhotoPanel photoId={originalId} onPhotoChange={changed} />);
  await screen.findByRole("img");
  choose(new File(["gif"], "photo.gif", { type: "image/gif" }));
  expect(screen.getByText("JPG 또는 PNG 사진을 선택해 주세요.")).toBeDefined();
  expect(screen.getByRole("img")).toBeDefined();
  expect(changed).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.some(([path]) => path === "/api/photos")).toBe(
    false,
  );
});

it("decimal-size overflow keeps original image and never mutates the reference", async () => {
  const changed = vi.fn();
  render(<PhotoPanel photoId={originalId} onPhotoChange={changed} />);
  await screen.findByRole("img");
  choose(
    new File([new Uint8Array(2_000_001)], "large.png", { type: "image/png" }),
  );
  expect(screen.getByText("사진은 2MB 이하만 가능합니다.")).toBeDefined();
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole("img")).toBeDefined();
});

it("server decode rejection uses actual API message, preserving the original picture and reference", async () => {
  const changed = vi.fn();
  render(<PhotoPanel photoId={originalId} onPhotoChange={changed} />);
  await screen.findByRole("img");
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: false,
        meta: {},
        code: "UNSUPPORTED_FILE_TYPE",
        message: "이미지 형식을 확인해 주세요.",
        field: "file",
      }),
      { status: 400 },
    ),
  );
  choose(new File(["not png"], "renamed.png", { type: "image/png" }));
  await screen.findByText("이미지 형식을 확인해 주세요.");
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole("img")).toBeDefined();
});

it("cancelled native selection performs no request", () => {
  render(<PhotoPanel photoId={null} onPhotoChange={vi.fn()} />);
  choose();
  expect(fetcher).not.toHaveBeenCalled();
});

it("unlink changes only the local photoId to null with no photo DELETE", async () => {
  const changed = vi.fn();
  function Editor() {
    const [id, setId] = useState<string | null>(originalId);
    return (
      <PhotoPanel
        photoId={id}
        onPhotoChange={(next) => {
          changed(next);
          setId(next);
        }}
      />
    );
  }
  render(<Editor />);
  await screen.findByRole("img");
  fireEvent.click(screen.getByRole("button", { name: "사진 삭제" }));
  expect(changed).toHaveBeenCalledWith(null);
  expect(screen.queryByRole("img")).toBeNull();
  expect(
    fetcher.mock.calls.some(([, request]) => request?.method === "DELETE"),
  ).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
});

it("photo GET failure hides bytes but does not roll back or change photoId", async () => {
  fetcher.mockResolvedValueOnce(new Response("{}", { status: 404 }));
  const changed = vi.fn();
  render(<PhotoPanel photoId={originalId} onPhotoChange={changed} />);
  expect(screen.getByText("사진 불러오는 중…")).toBeDefined();
  await screen.findByRole("alert");
  expect(changed).not.toHaveBeenCalled();
  expect(screen.queryByRole("img")).toBeNull();
});

it("session expiry from photo GET invokes the common login/draft boundary", async () => {
  fetcher.mockResolvedValueOnce(new Response("{}", { status: 401 }));
  const expired = vi.fn();
  window.addEventListener("session-expired", expired);
  render(<PhotoPanel photoId={originalId} onPhotoChange={vi.fn()} />);
  await waitFor(() => expect(expired).toHaveBeenCalledOnce());
  window.removeEventListener("session-expired", expired);
});

it("read-only parent prevents photo mutation", () => {
  render(<PhotoPanel photoId={null} onPhotoChange={vi.fn()} disabled />);
  expect(
    (screen.getByRole("button", { name: /사진 등록/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  choose(new File(["png"], "photo.png", { type: "image/png" }));
  expect(fetcher).not.toHaveBeenCalled();
});

it("local error toast disappears after exactly three seconds", () => {
  vi.useFakeTimers();
  render(<PhotoPanel photoId={null} onPhotoChange={vi.fn()} />);
  choose(new File(["gif"], "photo.gif", { type: "image/gif" }));
  expect(screen.getByRole("status")).toBeDefined();
  act(() => vi.advanceTimersByTime(2999));
  expect(screen.getByRole("status")).toBeDefined();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).toBeNull();
});

it("uses the selected photo ID for the private image path", () => {
  expect(photoUrl(originalId)).toBe(`/api/photos/${originalId}`);
});
