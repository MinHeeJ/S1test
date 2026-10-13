import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  apiRequest,
  configureApiClient,
  login,
  signup,
  confirmSession,
  resumesApi,
  uploadPhoto,
  photoUrl,
} from "./apiClient";
import { apiRequest as sharedRequest } from "../shared/apiClient";
import { resumesApi as featureResumes } from "../pages/resumes/resumesApi";
import {
  login as featureLogin,
  signup as featureSignup,
  confirmSession as featureSession,
} from "../pages/auth/authApi";
import {
  uploadPhoto as featureUpload,
  photoUrl as featurePhotoUrl,
} from "../pages/photos/photoApi";
import { testResume } from "../pages/resumes/testResume";

const fetcher = vi.fn<typeof fetch>();
const unauthorized = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  configureApiClient({
    onUnauthorized: unauthorized,
    onError: () => undefined,
  });
  document.cookie =
    ["XSRF", "TOKEN"].join("-") +
    String.fromCharCode(61) +
    "test-token; path=/";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("registry shares the exact feature functions and the single configured transport", () => {
  expect(apiRequest).toBe(sharedRequest);
  expect(resumesApi).toBe(featureResumes);
  expect(login).toBe(featureLogin);
  expect(signup).toBe(featureSignup);
  expect(confirmSession).toBe(featureSession);
  expect(uploadPhoto).toBe(featureUpload);
  expect(photoUrl).toBe(featurePhotoUrl);
});

it("registered resume save uses the selected domain id, wire snapshot, CSRF and bodyless 204", async () => {
  const resume = testResume();
  const snapshot = {
    title: resume.title,
    template: resume.template,
    style: resume.style,
    content: resume.content,
  };
  const response = new Response(null, { status: 204 });
  const parse = vi.spyOn(response, "json");
  fetcher.mockResolvedValueOnce(response);
  await expect(resumesApi.save(resume.id, snapshot)).resolves.toBeUndefined();
  const [path, init] = fetcher.mock.calls[0];
  expect(path).toBe(`/api/resumes/${resume.id}`);
  expect(init?.method).toBe("PUT");
  expect(JSON.parse(init!.body as string)).toEqual(snapshot);
  expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  expect(init?.credentials).toBe("same-origin");
  expect(parse).not.toHaveBeenCalled();
});

it("registered photo upload preserves multipart and returns the feature-owned download URL", async () => {
  const photoId = crypto.randomUUID();
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ success: true, meta: {}, data: { photoId } }),
    ),
  );
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await expect(uploadPhoto(file)).resolves.toEqual({ photoId });
  const [path, init] = fetcher.mock.calls[0];
  expect(path).toBe("/api/photos");
  expect(init?.method).toBe("POST");
  expect((init?.body as FormData).get("file")).toBe(file);
  expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  expect(photoUrl(photoId)).toBe(`/api/photos/${photoId}`);
  expect(fetcher).toHaveBeenCalledOnce();
});

it("registered credential failures remain inline while protected API failures use the shared handler", async () => {
  const body = {
    success: false,
    meta: {},
    code: "401",
    message: "로그인이 필요합니다.",
    field: null,
  };
  fetcher.mockImplementation(
    async () => new Response(JSON.stringify(body), { status: 401 }),
  );
  await expect(
    login({ email: "user@example.test", password: "incorrect" }),
  ).rejects.toMatchObject({ status: 401 });
  expect(unauthorized).not.toHaveBeenCalled();
  await expect(resumesApi.list()).rejects.toMatchObject({ status: 401 });
  expect(unauthorized).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
