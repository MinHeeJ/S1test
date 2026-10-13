import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../app/router";
import { useSessionStore } from "../../app/sessionStore";
import { configureApiClient } from "../../services/apiClient";
import { Toast, useToastStore } from "../../shared/Toast";
import { PhotoInput } from "./PhotoInput";
import { PhotoImage } from "./PhotoImage";

const fetcher = vi.fn<typeof fetch>();
const oldId = "246c9000-2daf-445a-9c5d-cf30f5e297c0";
const newId = "246c9000-2daf-445a-9c5d-cf30f5e297c1";

beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  document.cookie = ["XSRF", "TOKEN"].join("-") + "=test-token; path=/";
  useToastStore.getState().clear();
  useSessionStore.setState({
    user: { nickname: "사용자" },
    status: "authenticated",
    error: null,
  });
  configureApiClient({
    onUnauthorized: () => undefined,
    onError: () => undefined,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.useRealTimers();
});

function choose(type = "image/png", size = 10) {
  const file = new File([new Uint8Array(size)], "portrait.png", { type });
  fireEvent.change(screen.getByLabelText("사진 파일 선택"), {
    target: { files: [file] },
  });
  return file;
}
function success() {
  return new Response(
    JSON.stringify({ success: true, meta: {}, data: { photoId: newId } }),
    { status: 201 },
  );
}
function rejection(status: number, code: string) {
  return new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code,
      message: code,
      field: "file",
    }),
    { status },
  );
}
function EditorPhoto({ initial = oldId }: { initial?: string | null }) {
  const [id, setId] = useState(initial);
  return (
    <>
      <PhotoInput photoId={id} onChange={setId} />
      <PhotoImage photoId={id} alt="미리보기 사진" />
      <output aria-label="현재 연결">{id ?? "null"}</output>
      <Toast />
    </>
  );
}

it("authorized editor entry reaches the embedded photo control, not a separate photo menu", async () => {
  const router = createMemoryRouter(
    applicationRoutes([
      { path: "/resumes/:id/edit", element: <EditorPhoto initial={null} /> },
    ]),
    { initialEntries: ["/resumes/27/edit"] },
  );
  render(<RouterProvider router={router} />);
  expect(
    await screen.findByRole("button", { name: "사진 등록" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/resumes/27/edit");
  expect(fetcher).not.toHaveBeenCalled();
});

it("empty photo has no GET image, upload submit, or delete control", () => {
  render(<EditorPhoto initial={null} />);
  expect(screen.getByText("등록된 사진이 없습니다.")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "삭제" }),
  ).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it("selection immediately uploads multipart using shared CSRF then updates both views from returned id", async () => {
  fetcher.mockResolvedValueOnce(success());
  render(<EditorPhoto initial={null} />);
  const file = choose();
  await waitFor(() =>
    expect(screen.getByLabelText("현재 연결")).toHaveTextContent(newId),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("/api/photos");
  expect(init?.method).toBe("POST");
  expect(init?.credentials).toBe("same-origin");
  expect((init?.body as FormData).get("file")).toBe(file);
  expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  expect(
    screen.getByText("사진 업로드 완료 · 이력서 저장 대기"),
  ).toBeInTheDocument();
  const preview = screen.getByAltText("미리보기 사진");
  expect(preview).toHaveAttribute("src", `/api/photos/${newId}`);
  fireEvent.load(preview);
  expect(preview).toHaveStyle({
    aspectRatio: "3 / 4",
    objectFit: "cover",
    visibility: "visible",
  });
});

it("pending replacement retains old photo and blocks repeated selection and deletion", async () => {
  let resolve!: (response: Response) => void;
  fetcher.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<EditorPhoto />);
  choose();
  expect(screen.getByText("사진 업로드 중…")).toBeInTheDocument();
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent(oldId);
  expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "변경" })).toBeDisabled();
  choose();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => resolve(success()));
  await waitFor(() =>
    expect(screen.getByLabelText("현재 연결")).toHaveTextContent(newId),
  );
});

it("unsupported replacement keeps previous id and image and shows bottom error toast for three seconds", async () => {
  fetcher.mockResolvedValueOnce(rejection(400, "UNSUPPORTED_FILE_TYPE"));
  render(<EditorPhoto />);
  choose("image/gif");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "UNSUPPORTED_FILE_TYPE",
  );
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent(oldId);
  expect(screen.getByAltText("미리보기 사진")).toHaveAttribute(
    "src",
    `/api/photos/${oldId}`,
  );
  expect(
    screen.getByText("UNSUPPORTED_FILE_TYPE", { selector: ".toast" }),
  ).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("413 keeps existing photo and never retries an uncertain POST", async () => {
  fetcher.mockResolvedValueOnce(rejection(413, "FILE_TOO_LARGE"));
  render(<EditorPhoto />);
  choose("image/jpeg", 2_000_001);
  expect(await screen.findByRole("alert")).toHaveTextContent("FILE_TOO_LARGE");
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent(oldId);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("network rejection preserves photo and does not replay POST", async () => {
  fetcher.mockRejectedValueOnce(new Error("연결 실패"));
  render(<EditorPhoto />);
  choose();
  expect(await screen.findByRole("alert")).toHaveTextContent("연결 실패");
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent(oldId);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("remove immediately supplies null to shared snapshot flow without physical DELETE or modal", () => {
  render(<EditorPhoto />);
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent("null");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it("file selection cancellation changes nothing", () => {
  render(<EditorPhoto />);
  fireEvent.change(screen.getByLabelText("사진 파일 선택"), {
    target: { files: [] },
  });
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent(oldId);
  expect(fetcher).not.toHaveBeenCalled();
});

it("unavailable resume disables photo mutation", () => {
  const change = vi.fn();
  render(<PhotoInput photoId={oldId} onChange={change} disabled />);
  expect(screen.getByRole("button", { name: "사진 변경" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
  choose();
  expect(change).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it("failed image is not replaced with fabricated private content and signals print failure", () => {
  const failure = vi.fn();
  render(<PhotoImage photoId={oldId} onFailure={failure} />);
  expect(screen.getByText("사진 불러오는 중…")).toBeInTheDocument();
  fireEvent.error(screen.getByAltText("이력서 사진"));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "사진을 불러오지 못했습니다.",
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(failure).toHaveBeenCalledTimes(1);
});

it("successful upload keeps the new dirty snapshot when parent queue later reports save failure", async () => {
  fetcher.mockResolvedValueOnce(success());
  function Parent() {
    const [id, setId] = useState<string | null>(oldId);
    return (
      <>
        <PhotoInput photoId={id} onChange={setId} />
        <output aria-label="현재 연결">{id}</output>
        {id === newId && <span>저장 실패·다시 시도</span>}
      </>
    );
  }
  render(<Parent />);
  choose();
  expect(await screen.findByText("저장 실패·다시 시도")).toBeInTheDocument();
  expect(screen.getByLabelText("현재 연결")).toHaveTextContent(newId);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
