import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, configureApiEvents } from "./api";

const cookieName = ["XSRF", "TOKEN"].join("-");
const tokenCookie = () => {
  document.cookie = `${cookieName}=${"test-token"}; path=/`;
};
afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = `${cookieName}=; Max-Age=0; path=/`;
});

describe("session API transport", () => {
  it("sends session credentials and CSRF, preserving 204 as bodyless", async () => {
    tokenCookie();
    const transport = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", transport);
    expect(
      await apiRequest("/api/resumes/selected-id", {
        method: "PUT",
        body: "{}",
      }),
    ).toBeUndefined();
    const options = transport.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe("same-origin");
    expect(new Headers(options.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  });

  it("acquires missing token from public HTML before a write", async () => {
    const transport = vi.fn().mockImplementation(async (path: string) => {
      if (path === "/") {
        tokenCookie();
        return new Response("<!doctype html>");
      }
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", transport);
    await apiRequest("/api/resumes/selected-id", {
      method: "PATCH",
      body: '{"title":"제목"}',
    });
    expect(transport.mock.calls.map((call) => call[0])).toEqual([
      "/",
      "/api/resumes/selected-id",
    ]);
  });

  it("refreshes HTML token after authentication without parsing a 204 body", async () => {
    tokenCookie();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("<!doctype html>"));
    vi.stubGlobal("fetch", transport);
    await apiRequest("/api/auth/login", { method: "POST", body: "{}" });
    expect(transport.mock.calls[1][0]).toBe("/");
  });

  it("keeps successful binary bytes outside the JSON envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))),
    );
    const photo = await apiRequest<Blob>("/api/photos/selected-id", {
      binary: true,
    });
    expect(photo.size).toBe(3);
  });

  it("redirects protected 401 and reports the top-level error", async () => {
    const unauthorized = vi.fn();
    const error = vi.fn();
    configureApiEvents({ unauthorized, error });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
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
      ),
    );
    await expect(apiRequest("/api/resumes")).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith("로그인이 필요합니다.");
  });

  it("does not turn invalid login credentials into a redirect or automatic retry", async () => {
    tokenCookie();
    const unauthorized = vi.fn();
    configureApiEvents({ unauthorized, error: vi.fn() });
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          meta: {},
          code: "UNAUTHORIZED",
          message: "로그인 정보를 확인해 주세요.",
          field: null,
        }),
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", transport);
    await expect(
      apiRequest("/api/auth/login", { method: "POST", body: "{}" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledOnce();
  });

  it("rejects absolute URLs before making any request", async () => {
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    await expect(
      apiRequest("https://example.org/api/resumes"),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});
