import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  apiRequest,
  configureApiClient,
  login,
  signup,
  confirmSession,
  resumesApi,
  invoicesApi,
  invoiceCopyApi,
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
import { invoicesApi as featureInvoices } from "../pages/invoices/invoicesApi";
import { invoiceCopyApi as featureCopies } from "../pages/invoicesops/invoiceCopyApi";
import { testInvoice } from "../pages/invoices/invoiceFixture.test";

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
  expect(invoicesApi).toBe(featureInvoices);
  expect(invoiceCopyApi).toBe(featureCopies);
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

it("registered invoice list preserves filter and pagination and unwraps the contract", async () => {
  const data = { items: [testInvoice()], page: 2, size: 20, total: 21 };
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, meta: {}, data })),
  );
  await expect(invoicesApi.list("quote", 2)).resolves.toEqual(data);
  const [path, init] = fetcher.mock.calls[0];
  const url = new URL(String(path), window.location.origin);
  expect(url.pathname).toBe("/api/invoices");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    type: "quote",
    page: "2",
    size: "20",
  });
  expect(init?.method).toBe("GET");
  expect(init?.credentials).toBe("same-origin");
});

it("registered invoice save sends only writable fields and never parses empty 204", async () => {
  const invoice = testInvoice();
  const write = {
    title: invoice.title,
    content: invoice.content,
    paid: invoice.paid,
  };
  const result = new Response(null, { status: 204 });
  const parse = vi.spyOn(result, "json");
  fetcher.mockResolvedValueOnce(result);
  await expect(invoicesApi.save(invoice.id, write)).resolves.toBeUndefined();
  const [path, init] = fetcher.mock.calls[0];
  expect(path).toBe(`/api/invoices/${invoice.id}`);
  expect(init?.method).toBe("PUT");
  expect(JSON.parse(init!.body as string)).toEqual(write);
  expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  expect(init?.credentials).toBe("same-origin");
  expect(parse).not.toHaveBeenCalled();
});

it.each(["duplicate", "convert"] as const)(
  "both registered %s clients call the selected document command with session and CSRF",
  async (operation) => {
    const invoice = testInvoice();
    fetcher.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            meta: {},
            data: { id: "28" },
          }),
          { status: 201 },
        ),
    );
    await expect(invoicesApi[operation](invoice.id)).resolves.toEqual({
      id: "28",
    });
    await expect(invoiceCopyApi[operation](invoice.id)).resolves.toEqual({
      id: "28",
    });
    for (const [path, init] of fetcher.mock.calls) {
      expect(path).toBe(`/api/invoices/${invoice.id}/${operation}`);
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeUndefined();
      expect(init?.credentials).toBe("same-origin");
      expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
    }
  },
);

it("registered invoice failures preserve the shared authentication callback", async () => {
  fetcher.mockResolvedValueOnce(
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
  );
  await expect(invoicesApi.get(testInvoice().id)).rejects.toMatchObject({
    status: 401,
  });
  expect(unauthorized).toHaveBeenCalledOnce();
});
