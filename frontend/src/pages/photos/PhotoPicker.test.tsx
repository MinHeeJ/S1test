import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, type ApiResponse } from "../../shared/http";
import type { Resume } from "../../domain/resume/types";
import { PhotoPicker } from "./PhotoPicker";
import { PhotoImage } from "./PhotoImage";
import { photoUrl, withPhoto } from "./photoApi";

const existing = "846b351b-aa98-442b-81c2-8b2e22e1f567";
const uploaded = "48c64c5a-375c-4b9c-bb21-0e8b2f5b154d";
const resume: Resume = {
  id: "531db97b-0495-426a-a057-8309b6e571b3",
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
        email: "abc@",
        phone: "",
        links: [],
        photoId: existing,
      },
    },
    {
      type: "summary",
      hidden: true,
      data: { headline: "", body: "숨김 보존" },
    },
  ],
};
const unauthorized = vi.fn();
let calls: Array<{ path: string; init?: RequestInit }>;
let uploadStatus: number;
let getStatus: number;
let holdUpload: ((response: Response) => void) | undefined;
let delayed: boolean;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  calls = [];
  uploadStatus = 201;
  getStatus = 200;
  delayed = false;
  holdUpload = undefined;
  unauthorized.mockReset();
  document.cookie = "XSRF-TOKEN=photo-token";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === "/api/health") return json({ success: true, meta: {} });
      if (path === "/api/photos") {
        if (delayed)
          return new Promise<Response>((resolve) => {
            holdUpload = resolve;
          });
        if (uploadStatus === 201)
          return json(
            { success: true, meta: {}, data: { photoId: uploaded } },
            201,
          );
        return json(
          {
            success: false,
            meta: {},
            field: null,
            code:
              uploadStatus === 413 ? "FILE_TOO_LARGE" : "UNSUPPORTED_FILE_TYPE",
            message: "사진 변경 실패",
          },
          uploadStatus,
        );
      }
      if (path.startsWith("/api/photos/")) {
        if (getStatus !== 200)
          return json(
            {
              success: false,
              meta: {},
              code: "NOT_FOUND",
              message: "사진 접근 불가",
              field: null,
            },
            getStatus,
          );
        return new Response(new Blob(["image-bytes"], { type: "image/png" }));
      }
      if (path.startsWith("/api/resumes/"))
        return json({ success: true, meta: {} });
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function choose(
  file = new File(["png"], "portrait.png", { type: "image/png" }),
) {
  fireEvent.change(screen.getByLabelText("사진 파일 선택"), {
    target: { files: [file] },
  });
}

function EditorPhoto() {
  const [current, setCurrent] = useState(resume);
  const basics = current.content.find((section) => section.type === "basics");
  const id = basics?.type === "basics" ? basics.data.photoId : null;
  return (
    <PhotoPicker
      photoId={id}
      onUnauthorized={unauthorized}
      onPhotoChange={(photoId) => {
        const next = withPhoto(current, photoId);
        setCurrent(next);
        // Test host models the editor's save callback, not a second production autosave implementation.
        void request<ApiResponse>(`/api/resumes/${next.id}`, {
          method: "PUT",
          body: JSON.stringify({
            template: next.template,
            style: next.style,
            content: next.content,
          }),
        });
      }}
    />
  );
}

describe("SCR-RESUME-PHOTO embedded editor contract", () => {
  it("is reachable inside the authorized editor route; upload connects only the returned UUID", async () => {
    render(
      <MemoryRouter initialEntries={[`/resumes/${resume.id}/edit`]}>
        <Routes>
          <Route path="/resumes/:id/edit" element={<EditorPhoto />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByAltText("이력서 사진");
    choose();
    await waitFor(() =>
      expect(calls.some((call) => call.init?.method === "PUT")).toBe(true),
    );
    const upload = calls.find((call) => call.path === "/api/photos");
    expect(upload?.init?.body).toBeInstanceOf(FormData);
    expect((upload?.init?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(new Headers(upload?.init?.headers).has("Content-Type")).toBe(false);
    expect(new Headers(upload?.init?.headers).get("X-XSRF-TOKEN")).toBe(
      "photo-token",
    );
    const put = calls.find((call) => call.init?.method === "PUT");
    expect(put?.path).toBe(`/api/resumes/${resume.id}`);
    const body = JSON.parse(String(put?.init?.body));
    expect(body.content[0].data.photoId).toBe(uploaded);
    expect(body.content[0].data.email).toBe("abc@");
    expect(body.content[1]).toEqual(resume.content[1]);
    expect(body.style).toEqual(resume.style);
    expect(calls.some((call) => call.path === photoUrl(uploaded))).toBe(true);
    expect(screen.queryByText("저장됨")).toBeNull();
  });

  it.each([400, 413])(
    "keeps the existing photo and never PUTs after upload %s",
    async (status) => {
      uploadStatus = status;
      render(<EditorPhoto />);
      await screen.findByAltText("이력서 사진");
      choose(new File(["bad"], "changed.png", { type: "image/png" }));
      await screen.findByText("사진 변경 실패");
      expect(screen.getByAltText("이력서 사진").getAttribute("src")).toBe(
        "blob:photo",
      );
      expect(calls.filter((call) => call.init?.method === "PUT")).toHaveLength(
        0,
      );
      expect(
        calls.filter((call) => call.path === photoUrl(uploaded)),
      ).toHaveLength(0);
    },
  );

  it("preserves the old image while upload is pending and prevents a competing selection", async () => {
    delayed = true;
    const change = vi.fn();
    render(
      <PhotoPicker
        photoId={existing}
        onPhotoChange={change}
        onUnauthorized={unauthorized}
      />,
    );
    await screen.findByAltText("이력서 사진");
    choose();
    await waitFor(() => expect(holdUpload).toBeDefined());
    expect(screen.getByText("사진 업로드 중…")).toBeTruthy();
    expect(screen.getByAltText("이력서 사진")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "사진 변경" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(change).not.toHaveBeenCalled();
    choose();
    expect(calls.filter((call) => call.path === "/api/photos")).toHaveLength(1);
    await act(async () =>
      holdUpload?.(
        json({ success: true, meta: {}, data: { photoId: uploaded } }, 201),
      ),
    );
    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith(uploaded);
  });

  it("empty and canceled selection issue no image request or mutation", () => {
    render(
      <PhotoPicker
        photoId={null}
        onPhotoChange={vi.fn()}
        onUnauthorized={unauthorized}
      />,
    );
    expect(screen.getByRole("button", { name: "사진 등록" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "사진 삭제" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("사진 파일 선택"), {
      target: { files: [] },
    });
    expect(calls).toHaveLength(0);
  });

  it("read-only editor disables all mutations", () => {
    const change = vi.fn();
    render(
      <PhotoPicker
        photoId={null}
        onPhotoChange={change}
        onUnauthorized={unauthorized}
        disabled
      />,
    );
    choose();
    expect(change).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("removes only the reference and sends no photo DELETE", async () => {
    render(<EditorPhoto />);
    await screen.findByAltText("이력서 사진");
    fireEvent.click(screen.getByRole("button", { name: "사진 삭제" }));
    await waitFor(() =>
      expect(calls.some((call) => call.init?.method === "PUT")).toBe(true),
    );
    const put = calls.find((call) => call.init?.method === "PUT");
    expect(
      JSON.parse(String(put?.init?.body)).content[0].data.photoId,
    ).toBeNull();
    expect(screen.queryByAltText("이력서 사진")).toBeNull();
    expect(calls.some((call) => call.init?.method === "DELETE")).toBe(false);
  });

  it("passes 401 to the editor unsaved-navigation guard without replacing the reference", async () => {
    uploadStatus = 401;
    const change = vi.fn();
    render(
      <PhotoPicker
        photoId={existing}
        onPhotoChange={change}
        onUnauthorized={unauthorized}
      />,
    );
    await screen.findByAltText("이력서 사진");
    choose();
    await waitFor(() => expect(unauthorized).toHaveBeenCalledOnce());
    expect(change).not.toHaveBeenCalled();
  });

  it("does not display inaccessible photo bytes on 404", async () => {
    getStatus = 404;
    render(<PhotoImage photoId={existing} onUnauthorized={unauthorized} />);
    await screen.findByText("사진을 표시할 수 없습니다.");
    expect(screen.queryByAltText("이력서 사진")).toBeNull();
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it("image 401 invokes the same guard", async () => {
    getStatus = 401;
    render(<PhotoImage photoId={existing} onUnauthorized={unauthorized} />);
    await waitFor(() => expect(unauthorized).toHaveBeenCalledOnce());
    expect(screen.queryByAltText("이력서 사진")).toBeNull();
  });

  it("revokes original image URL when no longer displayed", async () => {
    const view = render(
      <PhotoImage photoId={existing} onUnauthorized={unauthorized} />,
    );
    await screen.findByAltText("이력서 사진");
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("dismisses the bottom error toast after three seconds", async () => {
    uploadStatus = 400;
    render(
      <PhotoPicker
        photoId={null}
        onPhotoChange={vi.fn()}
        onUnauthorized={unauthorized}
      />,
    );
    vi.useFakeTimers();
    await act(async () => {
      choose();
    });
    expect(screen.getByText("사진 변경 실패")).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText("사진 변경 실패")).toBeNull();
  });
});
