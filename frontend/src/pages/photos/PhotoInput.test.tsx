import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { configureApiEvents } from "../../shared/api";
import { Toast, useToast } from "../../shared/Toast";
import { PhotoInput } from "./PhotoInput";
import { PhotoImage } from "./PhotoImage";

const OLD = "10000000-0000-4000-8000-000000000001";
const NEW = "10000000-0000-4000-8000-000000000002";
const fetcher = vi.fn();
const imageResponse = () =>
  new Response(new Blob(["original"], { type: "image/png" }));
const success = () =>
  new Response(
    JSON.stringify({ success: true, meta: {}, data: { photoId: NEW } }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:owned-photo"),
      revokeObjectURL: vi.fn(),
    }),
  );
  document.cookie = "XSRF-TOKEN=photo-token";
  useToast.setState({ message: null });
  configureApiEvents({ unauthorized: vi.fn(), error: vi.fn() });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Editor({ initial = null }: { initial?: string | null }) {
  const [photoId, setPhotoId] = useState(initial);
  return (
    <>
      <PhotoInput photoId={photoId} onChange={setPhotoId} />
      <output aria-label="현재 사진 연결">{photoId ?? "null"}</output>
      <Toast />
    </>
  );
}
function select(size = 4, type = "image/png") {
  fireEvent.change(screen.getByLabelText("사진 파일"), {
    target: {
      files: [new File([new Uint8Array(size)], "selected.png", { type })],
    },
  });
}

describe("편집기의 사진 여정", () => {
  it("기존 편집 경로에서 선택 즉시 multipart 업로드하고 하나의 연결 콜백으로 저장을 예약한다", async () => {
    fetcher.mockResolvedValueOnce(success()).mockResolvedValue(imageResponse());
    render(
      <MemoryRouter initialEntries={["/resumes/selected-resume/edit"]}>
        <Routes>
          <Route path="/resumes/:id/edit" element={<Editor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    select();
    await waitFor(() =>
      expect(screen.getByLabelText("현재 사진 연결")).toHaveTextContent(NEW),
    );
    const [path, options] = fetcher.mock.calls[0];
    expect(path).toBe("/api/photos");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBeInstanceOf(File);
    expect(options.headers.get("X-XSRF-TOKEN")).toBe("photo-token");
    expect(options.headers.has("Content-Type")).toBe(false);
    await screen.findByRole("img", { name: "이력서 사진" });
    expect(fetcher.mock.calls[1][0]).toBe(`/api/photos/${NEW}`);
    expect(
      fetcher.mock.calls.every(([, init]) => (init.method ?? "GET") !== "PUT"),
    ).toBe(true);
  });

  it("업로드 진행 중 기존 사진을 유지하고 변경과 삭제를 잠근다", async () => {
    let finish: (response: Response) => void = () => undefined;
    fetcher
      .mockResolvedValueOnce(imageResponse())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(imageResponse());
    render(<Editor initial={OLD} />);
    await screen.findByRole("img");
    select();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(screen.getByLabelText("현재 사진 연결")).toHaveTextContent(OLD);
    expect(screen.getByRole("img")).toBeInTheDocument();
    await act(async () => finish(success()));
    await waitFor(() =>
      expect(screen.getByLabelText("현재 사진 연결")).toHaveTextContent(NEW),
    );
  });

  it.each([
    [400, "UNSUPPORTED_FILE_TYPE", "지원하지 않는 파일입니다."],
    [413, "FILE_TOO_LARGE", "파일이 너무 큽니다."],
  ])(
    "실패 %i이면 토스트와 기존 연결·이미지를 보존한다",
    async (status, code, message) => {
      fetcher.mockResolvedValueOnce(imageResponse()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            meta: {},
            code,
            message,
            field: "file",
          }),
          { status },
        ),
      );
      render(<Editor initial={OLD} />);
      await screen.findByRole("img");
      select();
      await screen.findByText(message);
      expect(screen.getByLabelText("현재 사진 연결")).toHaveTextContent(OLD);
      expect(screen.getByRole("img")).toBeInTheDocument();
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it("선택 취소는 요청과 연결 변경을 하지 않는다", () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("사진 파일"), {
      target: { files: [] },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByLabelText("현재 사진 연결")).toHaveTextContent("null");
  });

  it("삭제는 즉시 null 연결이며 사진 DELETE나 확인 모달이 없다", async () => {
    fetcher.mockResolvedValue(imageResponse());
    render(<Editor initial={OLD} />);
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByLabelText("현재 사진 연결")).toHaveTextContent("null");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("읽기 전용 상태는 업로드와 삭제를 금지한다", () => {
    render(<PhotoInput photoId={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "사진 등록" })).toBeDisabled();
    expect(screen.getByLabelText("사진 파일")).toBeDisabled();
  });

  it("렌더러용 사진은 원본 GET만 사용하고 3:4 cover로 표시하며 해제시 URL을 정리한다", async () => {
    fetcher.mockResolvedValue(imageResponse());
    const view = render(<PhotoImage photoId={OLD} />);
    const image = await screen.findByRole("img");
    expect(image.style.aspectRatio).toBe("3 / 4");
    expect(image.style.objectFit).toBe("cover");
    expect(fetcher.mock.calls[0][0]).toBe(`/api/photos/${OLD}`);
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:owned-photo");
  });

  it("404 사진은 가상 이미지 없이 오류만 표시한다", async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          meta: {},
          code: "NOT_FOUND",
          message: "자료를 찾을 수 없습니다.",
          field: null,
        }),
        { status: 404 },
      ),
    );
    render(<PhotoImage photoId={OLD} />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("401은 공유 API의 로그인 이동 경계를 호출하고 이미지를 노출하지 않는다", async () => {
    const unauthorized = vi.fn();
    configureApiEvents({ unauthorized, error: vi.fn() });
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          meta: {},
          code: "UNAUTHORIZED",
          message: "로그인이 필요합니다.",
          field: null,
        }),
        { status: 401 },
      ),
    );
    render(<PhotoImage photoId={OLD} />);
    await screen.findByRole("alert");
    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
