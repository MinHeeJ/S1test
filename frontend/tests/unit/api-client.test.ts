import { beforeEach, describe, expect, it, vi } from "vitest";

describe("same-origin session transport", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("bootstraps the actual header and token before a JSON mutation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            meta: { csrfToken: "test-token", csrfHeaderName: "X-XSRF-TOKEN" },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, meta: {} })),
      );
    vi.stubGlobal("fetch", fetcher);
    const { apiRequest } = await import("../../src/shared/apiClient");
    await apiRequest("/api/auth/login", { method: "POST", body: "{}" });
    expect(fetcher.mock.calls[0][0]).toBe("/api/health");
    expect(fetcher.mock.calls[1][0]).toBe("/api/auth/login");
    const options = fetcher.mock.calls[1][1];
    expect(options.credentials).toBe("same-origin");
    expect(options.headers.get("X-XSRF-TOKEN")).toBe("test-token");
    expect(options.headers.get("Content-Type")).toBe("application/json");
  });

  it("leaves multipart Content-Type to the browser and refreshes after a session change", async () => {
    const fetcher = vi.fn().mockImplementation((path: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            path === "/api/health"
              ? {
                  success: true,
                  meta: {
                    csrfToken: "new-token",
                    csrfHeaderName: "X-XSRF-TOKEN",
                  },
                }
              : { success: true, meta: {}, data: { photoId: "test-photo" } },
          ),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const { apiClient, refreshCsrf } = await import(
      "../../src/shared/apiClient"
    );
    await refreshCsrf();
    const form = new FormData();
    form.set("file", new Blob(["test-file"], { type: "image/png" }));
    await apiClient.post("/api/photos", form);
    expect(fetcher.mock.calls[1][1].headers.has("Content-Type")).toBe(false);
    expect(fetcher.mock.calls[1][1].body).toBe(form);
  });

  it("propagates the flat error without nested fields or persistence diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            meta: {},
            code: "401",
            message: "로그인이 필요합니다.",
            field: null,
          }),
          { status: 401 },
        ),
      ),
    );
    const { apiRequest, ApiRequestError } = await import(
      "../../src/shared/apiClient"
    );
    await expect(apiRequest("/api/resumes")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });

  it("rejects absolute URLs without issuing a request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { apiRequest } = await import("../../src/shared/apiClient");
    await expect(
      apiRequest("https://example.invalid/api/resumes"),
    ).rejects.toThrow(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
