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
  invoicesApi,
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
import { invoicesApi as featureInvoices } from "../pages/invoices/invoicesApi";
import { invoiceSnapshot } from "../pages/invoices/contracts";
import { testInvoice } from "../pages/invoices/testInvoice";
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

it("registered invoice client is the feature client and preserves list filters and metadata", async () => {
  expect(invoicesApi).toBe(featureInvoices);
  const page = { items: [testInvoice()], page: 2, size: 20, total: 21 };
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, meta: {}, data: page })),
  );
  await expect(invoicesApi.list("quote", 2)).resolves.toEqual(page);
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/invoices?page=2&size=20&type=quote",
  );
  expect(fetcher.mock.calls[0][1]?.method).toBe("GET");
});

it("registered invoice creation submits only the chosen type and returns the server id", async () => {
  const created = { id: testInvoice().id };
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, meta: {}, data: created })),
  );
  await expect(invoicesApi.create("invoice")).resolves.toEqual(created);
  const [path, init] = fetcher.mock.calls[0];
  expect(path).toBe("/api/invoices");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(init!.body as string)).toEqual({ docType: "invoice" });
  expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  expect(init?.credentials).toBe("same-origin");
});

it("registered invoice save sends the selected snapshot and does not parse bodyless 204", async () => {
  const invoice = testInvoice();
  const snapshot = invoiceSnapshot(invoice);
  const response = new Response(null, { status: 204 });
  const parse = vi.spyOn(response, "json");
  fetcher.mockResolvedValueOnce(response);
  await expect(invoicesApi.save(invoice.id, snapshot)).resolves.toBeUndefined();
  const [path, init] = fetcher.mock.calls[0];
  expect(path).toBe(`/api/invoices/${invoice.id}`);
  expect(init?.method).toBe("PUT");
  expect(JSON.parse(init!.body as string)).toEqual(snapshot);
  expect(Object.keys(snapshot).sort()).toEqual(["content", "paid", "title"]);
  expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
  expect(parse).not.toHaveBeenCalled();
});

it.each(["duplicate", "convert"] as const)(
  "registered invoice %s uses the selected id and no request body",
  async (command) => {
    const invoice = testInvoice();
    const created = { id: String(Number(invoice.id) + 1) };
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, meta: {}, data: created })),
    );
    await expect(invoicesApi[command](invoice.id)).resolves.toEqual(created);
    const [path, init] = fetcher.mock.calls[0];
    expect(path).toBe(`/api/invoices/${invoice.id}/${command}`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get("X-XSRF-TOKEN")).toBe("test-token");
    expect(fetcher).toHaveBeenCalledOnce();
  },
);

it("registered invoice deletion preserves the selected id and bodyless response", async () => {
  const response = new Response(null, { status: 204 });
  const parse = vi.spyOn(response, "json");
  fetcher.mockResolvedValueOnce(response);
  await expect(invoicesApi.delete(testInvoice().id)).resolves.toBeUndefined();
  expect(fetcher.mock.calls[0][0]).toBe(`/api/invoices/${testInvoice().id}`);
  expect(fetcher.mock.calls[0][1]?.method).toBe("DELETE");
  expect(parse).not.toHaveBeenCalled();
});

it("registered invoice reads retain shared unauthorized handling without retrying", async () => {
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
  expect(fetcher).toHaveBeenCalledOnce();
});
