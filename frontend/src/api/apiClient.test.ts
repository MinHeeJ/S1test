import { afterEach, describe, expect, it, vi } from "vitest";

function response(status: number, body: unknown, token?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: token ? { "X-CSRF-TOKEN": token } : {},
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("공통 API session/CSRF client", () => {
  it("bootstrap401의 token을 먼저 읽고 공개 POST에 전달한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(401, { success: false }, "csrf-fixture"))
      .mockResolvedValueOnce(response(201, { success: true, meta: {} }));
    vi.stubGlobal("fetch", fetcher);
    const { apiClient, setUnauthorizedHandler } = await import("./apiClient");
    const redirect = vi.fn();
    setUnauthorizedHandler(redirect);
    await apiClient.post("/api/auth/signup", { email: "fixture@resume.dev" });
    expect(fetcher.mock.calls[0][0]).toBe("/api/auth/me");
    expect(
      new Headers(fetcher.mock.calls[1][1].headers).get("X-CSRF-TOKEN"),
    ).toBe("csrf-fixture");
    expect(fetcher.mock.calls[1][1].credentials).toBe("same-origin");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("보호401은 오류를 보존하고 로그인으로 이동한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(401, {
          success: false,
          meta: {},
          code: "UNAUTHORIZED",
          message: "로그인이 필요합니다.",
          field: null,
        }),
      ),
    );
    const { apiClient, setUnauthorizedHandler } = await import("./apiClient");
    const redirect = vi.fn();
    setUnauthorizedHandler(redirect);
    await expect(apiClient.get("/api/resumes")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(redirect).toHaveBeenCalledOnce();
  });
  it("multipart boundary는 브라우저가 설정하고 선택한 파일만 전달한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(401, {}, "csrf-fixture"))
      .mockResolvedValueOnce(
        response(201, {
          success: true,
          meta: {},
          data: { photoId: "fixture" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { apiClient } = await import("./apiClient");
    const form = new FormData();
    form.append(
      "file",
      new File(["content"], "photo.png", { type: "image/png" }),
    );
    await apiClient.post("/api/photos", form);
    const options = fetcher.mock.calls[1][1];
    expect(options.body).toBe(form);
    expect(new Headers(options.headers).has("Content-Type")).toBe(false);
  });
  it("절대 URL을 거부하여 자격증명이 외부 host로 전송되지 않는다", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { apiRequest } = await import("./apiClient");
    await expect(apiRequest("https://example.com/api/resumes")).rejects.toThrow(
      "Relative API path required",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
