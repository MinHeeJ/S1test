import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhotoPicker } from "./PhotoPicker";
import { PhotoImage } from "./PhotoImage";
import { getPhoto, uploadPhoto } from "./photoApi";

const previousId = "d321e027-6bc2-4baa-a39d-0d81dfb0efb5";
const uploadedId = "da87e73b-c90c-4b89-a591-53e1bfa7fd53";
let requests: ReturnType<typeof vi.fn>;
const changed = vi.fn();
const expired = vi.fn();

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
function Harness({
  initial = previousId,
  disabled = false,
}: {
  initial?: string | null;
  disabled?: boolean;
}) {
  const [photoId, setPhotoId] = useState<string | null>(initial);
  return (
    <>
      <PhotoPicker
        photoId={photoId}
        disabled={disabled}
        onUnauthorized={expired}
        onPhotoChange={(id) => {
          changed(id);
          setPhotoId(id);
        }}
      />
      <output aria-label="본문 사진 참조">{photoId ?? "null"}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    (requests = vi.fn(async (path: string) => {
      if (path === "/api/auth/me")
        return json({}, 200, { "X-CSRF-TOKEN": "test-token" });
      if (path === "/api/photos")
        return json(
          { success: true, meta: {}, data: { photoId: uploadedId } },
          201,
        );
      return new Response(new Blob(["image bytes"], { type: "image/png" }), {
        status: 200,
      });
    })),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:photo-test");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function select(
  file = new File(["image fixture"], "portrait.png", { type: "image/png" }),
) {
  fireEvent.change(screen.getByLabelText("사진 파일"), {
    target: { files: [file] },
  });
}

describe("SCR-RESUME-PHOTO /resumes/:id/edit 내부 사진 영역", () => {
  it("사진 없는 입력 영역에서 선택기를 열며 선택 전 요청하지 않는다", () => {
    render(<Harness initial={null} />);
    const input = screen.getByLabelText("사진 파일");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "사진 등록" }));
    expect(click).toHaveBeenCalledOnce();
    expect(requests).not.toHaveBeenCalled();
  });

  it("선택 취소는 기존 참조를 바꾸거나 업로드하지 않는다", async () => {
    render(<Harness />);
    await screen.findByAltText("이력서 사진");
    fireEvent.change(screen.getByLabelText("사진 파일"), {
      target: { files: [] },
    });
    expect(changed).not.toHaveBeenCalled();
    expect(requests.mock.calls.some(([path]) => path === "/api/photos")).toBe(
      false,
    );
    expect(screen.getByLabelText("본문 사진 참조")).toHaveTextContent(
      previousId,
    );
  });

  it("성공 photoId만 부모 저장 큐로 전달하고 본인 바이너리를 표시한다", async () => {
    render(<Harness />);
    await screen.findByAltText("이력서 사진");
    select();
    await waitFor(() => expect(changed).toHaveBeenCalledWith(uploadedId));
    expect(screen.getByLabelText("본문 사진 참조")).toHaveTextContent(
      uploadedId,
    );
    await waitFor(() =>
      expect(requests).toHaveBeenCalledWith(
        `/api/photos/${uploadedId}`,
        expect.any(Object),
      ),
    );
    const mutation = requests.mock.calls.find(
      ([path]) => path === "/api/photos",
    );
    expect(mutation?.[1].method).toBe("POST");
    expect(mutation?.[1].headers).toEqual({ "X-CSRF-TOKEN": "test-token" });
    expect(mutation?.[1].credentials).toBe("same-origin");
    expect((mutation?.[1].body as FormData).get("file")).toBeInstanceOf(File);
    expect(
      requests.mock.calls.some(([, options]) => options?.method === "PUT"),
    ).toBe(false);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이력서 저장 상태를 확인하세요",
    );
  });

  it.each([400, 413, 500])(
    "업로드 %s 실패면 기존 사진과 참조 유지·부모 저장 호출 없음",
    async (status) => {
      render(<Harness />);
      await screen.findByAltText("이력서 사진");
      requests.mockImplementation(async (path: string) => {
        if (path === "/api/auth/me")
          return json({}, 200, { "X-CSRF-TOKEN": "test-token" });
        return json(
          {
            success: false,
            meta: {},
            code: "UPLOAD_ERROR",
            message: "사진 오류",
            field: "file",
          },
          status,
        );
      });
      select();
      await screen.findByRole("alert");
      expect(screen.getByRole("alert")).toHaveTextContent("사진 오류");
      expect(screen.getByLabelText("본문 사진 참조")).toHaveTextContent(
        previousId,
      );
      expect(screen.getByAltText("이력서 사진")).toBeVisible();
      expect(changed).not.toHaveBeenCalled();
    },
  );

  it("업로드 중 기존 사진을 유지하며 중복 선택으로 업로드를 경쟁시키지 않는다", async () => {
    let complete!: (response: Response) => void;
    render(<Harness />);
    await screen.findByAltText("이력서 사진");
    requests.mockImplementation((path: string) =>
      path === "/api/auth/me"
        ? Promise.resolve(json({}, 200, { "X-CSRF-TOKEN": "test-token" }))
        : new Promise<Response>((resolve) => {
            complete = resolve;
          }),
    );
    select();
    await waitFor(() => expect(complete).toBeDefined());
    expect(screen.getByText("사진 업로드 중…")).toBeVisible();
    expect(screen.getByAltText("이력서 사진")).toBeVisible();
    expect(screen.getByRole("button", { name: "변경" })).toBeDisabled();
    select();
    expect(
      requests.mock.calls.filter(([path]) => path === "/api/photos"),
    ).toHaveLength(1);
    complete(
      json({ success: true, meta: {}, data: { photoId: uploadedId } }, 201),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });

  it("사진 삭제는 null만 부모 큐에 전달하고 DELETE API를 만들지 않는다", async () => {
    render(<Harness />);
    await screen.findByAltText("이력서 사진");
    fireEvent.click(screen.getByRole("button", { name: "사진 삭제" }));
    expect(changed).toHaveBeenCalledWith(null);
    expect(screen.queryByAltText("이력서 사진")).not.toBeInTheDocument();
    expect(screen.getByLabelText("본문 사진 참조")).toHaveTextContent("null");
    expect(
      requests.mock.calls.some(([, options]) => options?.method === "DELETE"),
    ).toBe(false);
  });

  it("편집 불가 상태에서는 등록과 변경을 차단한다", () => {
    render(<Harness initial={null} disabled />);
    expect(screen.getByRole("button", { name: "사진 등록" })).toBeDisabled();
    select();
    expect(requests).not.toHaveBeenCalled();
  });

  it("401은 만료 안내/로그인 경계로 전달하고 기존 참조를 바꾸지 않는다", async () => {
    render(<Harness />);
    await screen.findByAltText("이력서 사진");
    requests.mockImplementation(async (path: string) =>
      path === "/api/auth/me"
        ? json({}, 200, { "X-CSRF-TOKEN": "test-token" })
        : json({ message: "Unauthorized" }, 401),
    );
    select();
    await waitFor(() => expect(expired).toHaveBeenCalledOnce());
    expect(changed).not.toHaveBeenCalled();
  });

  it("404 사진은 이미지로 노출하지 않고 참조를 임의로 삭제하지 않는다", async () => {
    requests.mockResolvedValue(json({ message: "Not Found" }, 404));
    render(<Harness />);
    await screen.findByText("사진을 불러올 수 없습니다.");
    expect(screen.queryByAltText("이력서 사진")).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it("미리보기에서도 같은 비공개 사진을 로드하고 해제 시 blob URL을 정리한다", async () => {
    const view = render(
      <PhotoImage photoId={previousId} onUnauthorized={expired} />,
    );
    await screen.findByAltText("이력서 사진");
    expect(requests).toHaveBeenCalledWith(
      `/api/photos/${previousId}`,
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo-test");
  });

  it("결과 토스트는 3초 후 제거된다", async () => {
    render(<Harness />);
    await screen.findByAltText("이력서 사진");
    select();
    await screen.findByRole("alert");
    await waitFor(
      () => expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      { timeout: 3500 },
    );
  });
});

describe("photo API byte 경계와 인증 전송", () => {
  it("정확히 2000000 bytes는 전송하지만 1byte 초과는 HTTP 전에 거부한다", async () => {
    await uploadPhoto(new File([new Uint8Array(2_000_000)], "image.png"));
    requests.mockClear();
    await expect(
      uploadPhoto(new File([new Uint8Array(2_000_001)], "image.png")),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
    expect(requests).not.toHaveBeenCalled();
  });

  it("바이너리 401은 상태를 보존하여 로그인 경계가 처리할 수 있다", async () => {
    requests.mockResolvedValue(
      json({ code: "Unauthorized", message: "Unauthorized" }, 401),
    );
    await expect(getPhoto(previousId)).rejects.toMatchObject({ status: 401 });
  });
});
