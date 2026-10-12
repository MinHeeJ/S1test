import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiClient, ApiError, configureApiEvents } from "./apiClient";
import { useSessionStore } from "../app/session";
import type { ResumeWrite } from "../pages/resumes/model";

const transport = vi.fn();
const selectedId = "chosen /문서";
const resource = `/api/resumes/${encodeURIComponent(selectedId)}`;
const draft: ResumeWrite = {
  title: "지원용",
  template: "classic",
  style: { color: "#1F3A5F", font: "pretendard", size: "medium" },
  content: [
    {
      type: "basics",
      hidden: false,
      data: {
        name: "",
        jobTitle: "",
        email: "abc@",
        phone: "",
        links: [],
        photoId: null,
      },
    },
  ],
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, meta: {}, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
  document.cookie = `${["XSRF", "TOKEN"].join("-")}=client-token; path=/`;
  configureApiEvents({ unauthorized: vi.fn(), error: vi.fn() });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = `${["XSRF", "TOKEN"].join("-")}=; Max-Age=0; path=/`;
});

it.each([
  [
    "signup",
    "POST",
    "/api/auth/signup",
    () =>
      apiClient.signup({
        email: "user@example.org",
        nickname: "사용자",
        password: "valid-password",
      }),
    204,
  ],
  [
    "login",
    "POST",
    "/api/auth/login",
    () =>
      apiClient.login({
        email: "user@example.org",
        password: "valid-password",
      }),
    204,
  ],
  ["logout", "POST", "/api/auth/logout", () => apiClient.logout(), 204],
  [
    "getCurrentUser",
    "GET",
    "/api/auth/me",
    () => apiClient.getCurrentUser(),
    200,
  ],
  ["listResumes", "GET", "/api/resumes", () => apiClient.listResumes(), 200],
  [
    "createResume",
    "POST",
    "/api/resumes",
    () => apiClient.createResume("지원용", "classic"),
    201,
  ],
  ["getResume", "GET", resource, () => apiClient.getResume(selectedId), 200],
  [
    "saveResume",
    "PUT",
    resource,
    () => apiClient.saveResume(selectedId, draft),
    204,
  ],
  [
    "renameResume",
    "PATCH",
    resource,
    () => apiClient.renameResume(selectedId, "새 제목"),
    204,
  ],
  [
    "deleteResume",
    "DELETE",
    resource,
    () => apiClient.deleteResume(selectedId),
    204,
  ],
  [
    "duplicateResume",
    "POST",
    `${resource}/duplicate`,
    () => apiClient.duplicateResume(selectedId),
    201,
  ],
  [
    "uploadPhoto",
    "POST",
    "/api/photos",
    () =>
      apiClient.uploadPhoto(
        new File(["image"], "selected.png", { type: "image/png" }),
      ),
    201,
  ],
  [
    "getPhoto",
    "GET",
    `/api/photos/${encodeURIComponent(selectedId)}`,
    () => apiClient.getPhoto(selectedId),
    200,
  ],
  ["getHealth", "GET", "/api/health", () => apiClient.getHealth(), 200],
] as const)(
  "%s invokes the registered feature client with the approved HTTP boundary",
  async (operation, method, path, invoke, status) => {
    transport.mockImplementation(async (url: string) => {
      if (url === "/") return new Response("<!doctype html>");
      if (operation === "getPhoto")
        return new Response(new Uint8Array([1, 2, 3]));
      if (status === 204) return new Response(null, { status });
      if (operation === "getCurrentUser") return json({ nickname: "사용자" });
      if (operation === "listResumes") return json([]);
      if (operation === "getHealth")
        return new Response(JSON.stringify({ success: true, meta: {} }));
      return json({ id: selectedId, photoId: selectedId }, status);
    });
    const result = await invoke();
    const requests = transport.mock.calls.filter(([url]) => url !== "/");
    expect(requests).toHaveLength(1);
    const [url, init] = requests[0] as [string, RequestInit];
    expect(url).toBe(path);
    expect(init.method ?? "GET").toBe(method);
    expect(init.credentials).toBe("same-origin");
    const headers = new Headers(init.headers);
    if (method !== "GET")
      expect(headers.get("X-XSRF-TOKEN")).toBe("client-token");
    if (status === 204) expect(result).toBeUndefined();
    if (operation === "createResume" || operation === "duplicateResume")
      expect(result).toEqual({
        id: selectedId,
        photoId: selectedId,
      });
    if (operation === "signup")
      expect(JSON.parse(init.body as string)).toEqual({
        email: "user@example.org",
        nickname: "사용자",
        password: "valid-password",
      });
    if (operation === "saveResume")
      expect(JSON.parse(init.body as string)).toEqual(draft);
    if (operation === "uploadPhoto") {
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get("file")).toBeInstanceOf(File);
      expect(headers.has("Content-Type")).toBe(false);
      expect(result).toEqual({ id: selectedId, photoId: selectedId });
    }
    if (operation === "getPhoto") expect((result as Blob).size).toBe(3);
    if (["signup", "login", "logout"].includes(operation))
      expect(transport.mock.calls.at(-1)?.[0]).toBe("/");
  },
);

it("failed editor flush prevents registered logout and preserves the session", async () => {
  useSessionStore.setState({
    status: "authenticated",
    user: { nickname: "사용자" },
    error: null,
  });
  await expect(
    apiClient.logout(async () => {
      throw new Error("save failed");
    }),
  ).rejects.toThrow("save failed");
  expect(transport).not.toHaveBeenCalled();
  expect(useSessionStore.getState().status).toBe("authenticated");
});

it("protected failure reaches the same shared events as feature clients", async () => {
  const unauthorized = vi.fn();
  configureApiEvents({ unauthorized, error: vi.fn() });
  transport.mockResolvedValue(
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
  );
  await expect(apiClient.getResume(selectedId)).rejects.toBeInstanceOf(
    ApiError,
  );
  expect(unauthorized).toHaveBeenCalledOnce();
});
