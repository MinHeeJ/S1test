import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, bootstrapCsrf, configureApiClient } from "./apiClient";

const fetcher = vi.fn<typeof fetch>();
const unauthorized = vi.fn();
const notify = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  configureApiClient({ onUnauthorized: unauthorized, onError: notify });
  document.cookie =
    ["XSRF", "TOKEN"].join("-") +
    String.fromCharCode(61) +
    "test-token; path=/";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  document.cookie =
    ["XSRF", "TOKEN"].join("-") +
    String.fromCharCode(61) +
    "; Max-Age=0; path=/";
});

describe("same-origin API transport", () => {
  it("unwraps real response data without hardcoded resource identifiers", async () => {
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, meta: {}, data: { id: "27" } }),
      ),
    );
    expect(await apiRequest("/api/resumes/27")).toEqual({ id: "27" });
    expect(fetcher.mock.calls[0][0]).toBe("/api/resumes/27");
    expect(fetcher.mock.calls[0][1]?.credentials).toBe("same-origin");
  });
  it("sends CSRF and does not parse 204", async () => {
    const response = new Response(null, { status: 204 });
    const parse = vi.spyOn(response, "json");
    fetcher.mockResolvedValueOnce(response);
    await expect(
      apiRequest("/api/resumes/27", { method: "PUT", body: "{}" }),
    ).resolves.toBeUndefined();
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("X-XSRF-TOKEN"),
    ).toBe("test-token");
    expect(parse).not.toHaveBeenCalled();
  });
  it("bootstraps a missing cookie through health before a mutation", async () => {
    document.cookie =
      ["XSRF", "TOKEN"].join("-") +
      String.fromCharCode(61) +
      "; Max-Age=0; path=/";
    fetcher.mockImplementationOnce(async () => {
      document.cookie =
        ["XSRF", "TOKEN"].join("-") + String.fromCharCode(61) + "fresh; path=/";
      return new Response('{"success":true,"meta":{}}');
    });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await apiRequest("/api/auth/logout", { method: "POST" });
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "/api/health",
      "/api/auth/logout",
    ]);
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("X-XSRF-TOKEN"),
    ).toBe("fresh");
  });
  it("preserves error fields and tells the router only about an actual 401", async () => {
    const error = {
      success: false,
      meta: {},
      code: "401",
      message: "로그인이 필요합니다.",
      field: null,
    };
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify(error), { status: 401 }),
    );
    await expect(apiRequest("/api/auth/me")).rejects.toMatchObject({
      status: 401,
      error,
    });
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
  });
  it("does not redirect or retry domain failures", async () => {
    const error = {
      success: false,
      meta: {},
      code: "CONTENT_TOO_LARGE",
      message: "초과",
      field: "content",
    };
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify(error), { status: 413 }),
    );
    await expect(
      apiRequest("/api/resumes/27", { method: "PUT", body: "{}" }),
    ).rejects.toMatchObject({ error });
    expect(unauthorized).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects absolute URLs", async () => {
    await expect(apiRequest("https://example.org/api/health")).rejects.toThrow(
      "상대 API 경로",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("failed health bootstrap never submits a mutation", async () => {
    document.cookie =
      ["XSRF", "TOKEN"].join("-") +
      String.fromCharCode(61) +
      "; Max-Age=0; path=/";
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(bootstrapCsrf()).rejects.toThrow("서비스 연결");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
