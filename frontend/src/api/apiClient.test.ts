import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resumeSeeds } from "../../tests/fixtures/resumeSeeds";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function transport() {
  const fetcher = vi.fn(
    async (path: string) =>
      new Response(
        JSON.stringify(
          path === "/api/health"
            ? {
                success: true,
                meta: {
                  csrfToken: "registry-token",
                  csrfHeaderName: "X-XSRF-TOKEN",
                },
              }
            : {
                success: true,
                meta: {},
                data:
                  path === "/api/auth/me"
                    ? { nickname: "지우" }
                    : { id: "73", photoId: "a-photo" },
              },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("application API registry", () => {
  it("exports the original clients without a second transport or feature-to-registry cycle", async () => {
    const registry = await import("./apiClient");
    const shared = await import("../shared/apiClient");
    const auth = await import("../pages/auth/authApi");
    const resumes = await import("../pages/resumes/api");
    const photos = await import("../pages/photos/api");
    expect(registry.apiClient).toBe(shared.apiClient);
    expect(registry.apiRequest).toBe(shared.apiRequest);
    expect(registry.ApiRequestError).toBe(shared.ApiRequestError);
    expect(registry.refreshCsrf).toBe(shared.refreshCsrf);
    expect(registry.login).toBe(auth.login);
    expect(registry.signup).toBe(auth.signup);
    expect(registry.logout).toBe(auth.logout);
    expect(registry.getCurrentUser).toBe(auth.getCurrentUser);
    expect(registry.resumeApi).toBe(resumes.resumeApi);
    expect(registry.uploadPhoto).toBe(photos.uploadPhoto);
    expect(registry.getPhoto).toBe(photos.getPhoto);
    expect(registry.photoUrl).toBe(photos.photoUrl);
  });

  it("uses the existing resume client paths and excludes title and identity from whole-document PUT", async () => {
    const fetcher = transport();
    const { resumeApi } = await import("./apiClient");
    const resume = { ...structuredClone(resumeSeeds[0]), id: "selected/id" };
    await resumeApi.list(2, 10, "title%");
    await resumeApi.get(resume.id);
    await resumeApi.create("새 이력서", "modern");
    await resumeApi.save(resume);
    await resumeApi.rename(resume.id, "새 제목");
    await resumeApi.remove(resume.id);
    await resumeApi.duplicate(resume.id);
    const requests = fetcher.mock.calls.filter(
      ([path]) => path !== "/api/health",
    );
    expect(requests.map(([path]) => path)).toEqual([
      "/api/resumes?page=2&size=10&filter=title%25",
      "/api/resumes/selected%2Fid",
      "/api/resumes",
      "/api/resumes/selected%2Fid",
      "/api/resumes/selected%2Fid",
      "/api/resumes/selected%2Fid",
      "/api/resumes/selected%2Fid/duplicate",
    ]);
    const options = (fetcher as ReturnType<typeof vi.fn>).mock.calls
      .filter(([path]) => path !== "/api/health")
      .map(([, init]) => init as RequestInit);
    expect(options.map((init) => init.method ?? "GET")).toEqual([
      "GET",
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "POST",
    ]);
    expect(JSON.parse(options[3].body as string)).toEqual({
      template: resume.template,
      style: resume.style,
      content: resume.content,
    });
    expect(JSON.parse(options[4].body as string)).toEqual({ title: "새 제목" });
    expect(options[5].body).toBeUndefined();
    expect(options[6].body).toBeUndefined();
  });

  it("refreshes CSRF after authentication and bootstraps registered mutations through public health", async () => {
    const fetcher = transport();
    const { signup, login, logout, getCurrentUser } = await import(
      "./apiClient"
    );
    await signup({
      email: "new@resume.dev",
      nickname: "새사용자",
      password: "test-password",
    });
    await login({ email: "new@resume.dev", password: "test-password" });
    expect(await getCurrentUser()).toEqual({ nickname: "지우" });
    await logout();
    const requests = (fetcher as ReturnType<typeof vi.fn>).mock.calls;
    expect(requests.map(([path]) => path)).toEqual([
      "/api/health",
      "/api/auth/signup",
      "/api/health",
      "/api/auth/login",
      "/api/health",
      "/api/auth/me",
      "/api/auth/logout",
      "/api/health",
    ]);
    for (const [path, init] of requests) {
      expect(init.credentials).toBe("same-origin");
      if (path !== "/api/health" && init.method === "POST") {
        expect(init.headers.get("X-XSRF-TOKEN")).toBe("registry-token");
      }
    }
  });

  it("registers multipart upload and raw binary download using the selected photo identifier", async () => {
    const fetcher = transport();
    const { uploadPhoto, getPhoto, photoUrl } = await import("./apiClient");
    const file = new File(["image-content"], "portrait.png", {
      type: "image/png",
    });
    const id = await uploadPhoto(file);
    const options = (fetcher as ReturnType<typeof vi.fn>).mock.calls[1][1];
    expect(options.body.get("file")).toBe(file);
    expect(options.headers.has("Content-Type")).toBe(false);
    expect(photoUrl(id)).toBe("/api/photos/a-photo");
    const image = new TextEncoder().encode("image-content");
    fetcher.mockImplementationOnce(
      async () =>
        new Response(image, { headers: { "Content-Type": "image/png" } }),
    );
    const blob = await getPhoto(id);
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("image-content");
    expect(fetcher).toHaveBeenLastCalledWith(photoUrl(id), {
      credentials: "same-origin",
      signal: undefined,
    });
  });
});
