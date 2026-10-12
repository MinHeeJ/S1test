import { afterEach, expect, it, vi } from "vitest";
import { getCurrentUser, login, logout, signup } from "./authApi";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
afterEach(() => vi.unstubAllGlobals());
it("auth uses relative JSON paths and refreshes CSRF after session replacement", async () => {
  const fetcher = vi.fn(async (path: string) =>
    path === "/api/health"
      ? response({
          success: true,
          meta: {
            csrfToken: "generated-token",
            csrfHeaderName: "X-XSRF-TOKEN",
          },
        })
      : path === "/api/auth/me"
        ? response({ success: true, meta: {}, data: { nickname: "지우" } })
        : response({ success: true, meta: {} }),
  );
  vi.stubGlobal("fetch", fetcher);
  await login({ email: "jiwoo@resume.dev", password: "demo1234" });
  expect(await getCurrentUser()).toEqual({ nickname: "지우" });
  await signup({
    email: "new@resume.dev",
    nickname: "가입",
    password: "password8",
  });
  await logout();
  const loginCall = fetcher.mock.calls.find(
    (call) => call[0] === "/api/auth/login",
  )!;
  const init = (loginCall as unknown as [string, RequestInit])[1];
  expect(JSON.parse(init.body as string)).toEqual({
    email: "jiwoo@resume.dev",
    password: "demo1234",
  });
  expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("generated-token");
  expect(
    fetcher.mock.calls.filter((call) => call[0] === "/api/health"),
  ).toHaveLength(4);
  expect(fetcher.mock.calls.map((call) => call[0])).toContain(
    "/api/auth/logout",
  );
});
