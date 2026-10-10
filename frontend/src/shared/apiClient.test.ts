import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "./apiClient";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
  vi.unstubAllGlobals();
});

describe("same-origin session and CSRF boundary", () => {
  it("reads the actual success envelope without inventing data", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ success: true, meta: {} }));
    vi.stubGlobal("fetch", fetcher);
    expect(await apiRequest("/api/health")).toEqual({
      success: true,
      meta: {},
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("bootstraps health cookie and forwards its header before mutations", async () => {
    const fetcher = vi.fn().mockImplementation(async (path: string) => {
      if (path === "/api/health")
        document.cookie = "XSRF-TOKEN=test-token; path=/";
      return response({ success: true, meta: {} });
    });
    vi.stubGlobal("fetch", fetcher);
    await apiRequest("/api/resumes", {
      method: "POST",
      body: JSON.stringify({ title: "입력 제목", template: "classic" }),
    });
    expect(fetcher.mock.calls[0][0]).toBe("/api/health");
    const options = fetcher.mock.calls[1][1] as RequestInit;
    expect(new Headers(options.headers).get("X-XSRF-TOKEN")).toBe("test-token");
    expect(new Headers(options.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("never overwrites multipart content type with JSON", async () => {
    document.cookie = "XSRF-TOKEN=test-token; path=/";
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({ success: true, meta: {}, data: { photoId: "returned-id" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const form = new FormData();
    form.append(
      "file",
      new File(["bytes"], "photo.png", { type: "image/png" }),
    );
    await apiRequest("/api/photos", { method: "POST", body: form });
    expect(
      new Headers(fetcher.mock.calls[0][1].headers).has("Content-Type"),
    ).toBe(false);
  });

  it("preserves server messages and single nullable field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(
          {
            success: false,
            meta: {},
            code: "404",
            message: "찾을 수 없습니다.",
            field: null,
          },
          404,
        ),
      ),
    );
    await expect(apiRequest("/api/resumes/selected-id")).rejects.toMatchObject({
      status: 404,
      message: "찾을 수 없습니다.",
      body: { field: null },
    });
  });

  it("notifies session expiration without storing or discarding a draft", async () => {
    const listener = vi.fn();
    window.addEventListener("session-expired", listener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(
          {
            success: false,
            meta: {},
            code: "401",
            message: "로그인이 필요합니다.",
            field: null,
          },
          401,
        ),
      ),
    );
    await expect(apiRequest("/api/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("session-expired", listener);
  });

  it("rejects absolute URLs before any network call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      apiRequest("https://example.org/api/resumes"),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not send a mutation if health cannot initialize the token", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({}, 500));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      apiRequest("/api/photos", { method: "POST" }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
