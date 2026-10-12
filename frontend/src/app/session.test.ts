import { afterEach, expect, it, vi } from "vitest";
import { useSessionStore } from "./session";

afterEach(() => vi.unstubAllGlobals());
it("missing nickname is an error, never a synthetic user or anonymous session", async () => {
  const response = new Response(
    JSON.stringify({ success: true, meta: {}, data: {} }),
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await useSessionStore.getState().load();
  expect(useSessionStore.getState().status).toBe("error");
  expect(useSessionStore.getState().user).toBeNull();
});
it("anonymous me clears stale user identity", async () => {
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "지우" },
  });
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
  await useSessionStore.getState().load();
  expect(useSessionStore.getState().status).toBe("anonymous");
  expect(useSessionStore.getState().user).toBeNull();
});
