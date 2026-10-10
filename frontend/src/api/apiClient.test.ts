import { afterEach, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "./apiClient";
import {
  apiRequest as compatibleRequest,
  ApiError as CompatibleError,
} from "../shared/apiClient";

const response = (status = 200) =>
  new Response(
    JSON.stringify(
      status === 200
        ? {
            success: true,
            meta: {},
          }
        : {
            success: false,
            meta: {},
            code: String(status),
            message: "요청 실패",
            field: null,
          },
    ),
    { status },
  );
const listeners: [string, EventListener][] = [];
function listen(name: string) {
  const listener = vi.fn();
  window.addEventListener(name, listener);
  listeners.push([name, listener]);
  return listener;
}
afterEach(() => {
  for (const [name, listener] of listeners.splice(0))
    window.removeEventListener(name, listener);
  document.cookie = ["XSRF-TOKEN", ""].join("=") + "; Max-Age=0; path=/";
  vi.unstubAllGlobals();
});

it("legacy feature imports use the identical canonical transport and error type", () => {
  expect(compatibleRequest).toBe(apiRequest);
  expect(CompatibleError).toBe(ApiError);
});

it.each(["/api/auth/login", "/api/auth/signup"])(
  "%s announces only successful trimmed case-sensitive email and refreshes the CSRF cookie",
  async (path) => {
    const identity = listen("session-identity");
    document.cookie = ["XSRF-TOKEN", "old-token"].join("=") + "; path=/";
    const fetcher = vi.fn(async (url: string) => {
      if (url === "/api/health")
        document.cookie = ["XSRF-TOKEN", "new-token"].join("=") + "; path=/";
      return response();
    });
    vi.stubGlobal("fetch", fetcher);
    await apiRequest(path, {
      method: "POST",
      body: JSON.stringify({ email: " Owner@example.org ", password: "input" }),
    });
    expect(identity).toHaveBeenCalledOnce();
    expect((identity.mock.calls[0][0] as CustomEvent).detail).toBe(
      "Owner@example.org",
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      path,
      "/api/health",
    ]);
    await apiRequest("/api/resumes", {
      method: "POST",
      body: JSON.stringify({ title: "입력", template: "classic" }),
    });
    const options = vi.mocked(fetch).mock.calls[2][1] as RequestInit;
    expect(new Headers(options.headers).get("X-XSRF-TOKEN")).toBe("new-token");
  },
);

it("successful authentication stays successful when optional CSRF refresh is unavailable", async () => {
  document.cookie = ["XSRF-TOKEN", "test-token"].join("=") + "; path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health") throw new Error("health offline");
      return response();
    }),
  );
  await expect(
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "owner@example.org", password: "input" }),
    }),
  ).resolves.toEqual({ success: true, meta: {} });
});
it("failed login never changes identity or silently retries a mutation", async () => {
  const identity = listen("session-identity");
  document.cookie = ["XSRF-TOKEN", "test-token"].join("=") + "; path=/";
  const fetcher = vi.fn().mockResolvedValue(response(401));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "other@example.org", password: "input" }),
    }),
  ).rejects.toMatchObject({ status: 401 });
  expect(identity).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledOnce();
});

it("successful logout announces draft disposal without inventing response data", async () => {
  const logout = listen("session-logged-out");
  document.cookie = ["XSRF-TOKEN", "test-token"].join("=") + "; path=/";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
  expect(await apiRequest("/api/auth/logout", { method: "POST" })).toEqual({
    success: true,
    meta: {},
  });
  expect(logout).toHaveBeenCalledOnce();
});

it("CSRF denial is not session expiry or successful logout", async () => {
  const logout = listen("session-logged-out");
  const expiry = listen("session-expired");
  document.cookie = ["XSRF-TOKEN", "test-token"].join("=") + "; path=/";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(403)));
  await expect(
    apiRequest("/api/auth/logout", { method: "POST" }),
  ).rejects.toMatchObject({ status: 403 });
  expect(logout).not.toHaveBeenCalled();
  expect(expiry).not.toHaveBeenCalled();
});
