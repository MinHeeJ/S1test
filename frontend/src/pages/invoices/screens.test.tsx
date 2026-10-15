import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProtectedRoute } from "../../app/ProtectedRoute";
import { useSessionStore } from "../../app/sessionStore";
import { useToastStore } from "../../shared/Toast";
import { ApiRequestError } from "../../shared/apiClient";
import { flushBeforeNavigation } from "../../app/navigationGuard";
import { invoiceScreens } from "./screens";
import { invoicesApi } from "./invoicesApi";
import { testInvoice } from "./invoiceFixture.test";
import { InvoiceRenderer } from "./InvoiceRenderer";
import { invoiceImagesReady } from "./SCR-INVOICE-PRINT";
import { uploadPhoto } from "../photos/photoApi";

vi.mock("./invoicesApi", () => ({
  invoicesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    convert: vi.fn(),
  },
}));
vi.mock("../photos/photoApi", () => ({
  uploadPhoto: vi.fn(),
  photoUrl: (id: string) => `/api/photos/${encodeURIComponent(id)}`,
}));
const api = vi.mocked(invoicesApi);
beforeEach(() => {
  useSessionStore.setState({
    user: { nickname: "지우" },
    status: "authenticated",
    error: null,
  });
  useToastStore.getState().clear();
  api.list.mockResolvedValue({
    items: [testInvoice()],
    page: 1,
    size: 20,
    total: 1,
  });
  api.get.mockResolvedValue(testInvoice());
  api.save.mockResolvedValue(undefined);
  api.create.mockResolvedValue({ id: "28" });
  api.duplicate.mockResolvedValue({ id: "28" });
  api.convert.mockResolvedValue({ id: "28" });
  api.delete.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function open(path = "/invoices") {
  const router = createMemoryRouter(
    [
      { element: <ProtectedRoute />, children: invoiceScreens },
      { path: "/login", element: <h1>로그인</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
async function editor() {
  const router = open("/invoices/27/edit");
  await screen.findByLabelText("수신자 상호");
  return router;
}
async function menu() {
  await screen.findByText("Q-2026-0001");
  fireEvent.click(screen.getByRole("button", { name: "Q-2026-0001 메뉴" }));
}
it("authorized list entry opens the actual selected document", async () => {
  const router = open();
  fireEvent.click(await screen.findByRole("link", { name: "지원 견적" }));
  await screen.findByLabelText("수신자 상호");
  expect(router.state.location.pathname).toBe("/invoices/27/edit");
  expect(api.get).toHaveBeenCalledWith("27");
});
it("anonymous admission never fetches private data", async () => {
  useSessionStore.getState().clear();
  open("/invoices/27/edit");
  expect(
    await screen.findByRole("heading", { name: "로그인" }),
  ).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
it("list loading and empty states retain real create controls", async () => {
  api.list.mockResolvedValue({ items: [], page: 1, size: 20, total: 0 });
  open();
  expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
  await screen.findByText("해당 종류 문서가 없습니다.");
  expect(screen.getByRole("button", { name: "+ 새 견적서" })).toBeEnabled();
});
it("list errors have a read-only retry", async () => {
  api.list.mockRejectedValueOnce(new Error("목록 오류"));
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("목록 오류");
  fireEvent.click(screen.getByRole("button", { name: "다시 조회" }));
  await screen.findByRole("link", { name: "지원 견적" });
  expect(api.create).not.toHaveBeenCalled();
});
it("filters use approved types, reset page and reflect server paid badges", async () => {
  const doc = { ...testInvoice(), doc_type: "invoice" as const, paid: true };
  open();
  await menu();
  api.list.mockResolvedValue({ items: [doc], page: 1, size: 20, total: 21 });
  fireEvent.click(screen.getByRole("button", { name: "청구서" }));
  await screen.findByText("입금 완료");
  expect(api.list).toHaveBeenLastCalledWith("invoice", 1);
  api.list.mockResolvedValue({ items: [doc], page: 2, size: 20, total: 21 });
  fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));
  await screen.findByText("2 페이지 · 21건");
  expect(api.list).toHaveBeenLastCalledWith("invoice", 2);
});
it("create sends only selected type and navigates with returned identity", async () => {
  api.get.mockResolvedValue({ ...testInvoice(), id: "28" });
  const router = open();
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "+ 새 청구서" }));
  await screen.findByLabelText("수신자 상호");
  expect(api.create).toHaveBeenCalledWith("invoice");
  expect(router.state.location.pathname).toBe("/invoices/28/edit");
});
it("delete modal cancellation preserves selected page and sends zero DELETEs", async () => {
  open();
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Q-2026-0001");
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
  );
  expect(api.delete).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "지원 견적" })).toBeInTheDocument();
});
it("delete failure keeps modal; retry succeeds and refreshes same context", async () => {
  api.delete.mockRejectedValueOnce(new Error("삭제 오류"));
  open();
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  expect(
    await within(screen.getByRole("dialog")).findByRole("alert"),
  ).toHaveTextContent("삭제 오류");
  api.list.mockResolvedValue({ items: [], page: 1, size: 20, total: 0 });
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "삭제 확인",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(api.delete).toHaveBeenCalledWith("27");
  await screen.findByText("해당 종류 문서가 없습니다.");
});
it("duplicate calls the sibling contract and refreshes without changing original route", async () => {
  const router = open();
  await menu();
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  await waitFor(() => expect(api.duplicate).toHaveBeenCalledWith("27"));
  expect(router.state.location.pathname).toBe("/invoices");
});
it("editor rejects mismatched response identity and 404 without exposing content", async () => {
  api.get.mockResolvedValue({ ...testInvoice(), id: "wrong" });
  open("/invoices/27/edit");
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("수신자 상호")).not.toBeInTheDocument();
  expect(api.save).not.toHaveBeenCalled();
});
it("editor dates are date inputs and immutable number/type never enter the saved payload", async () => {
  await editor();
  expect(screen.getByLabelText("발행일")).toHaveAttribute("type", "date");
  expect(screen.getByLabelText("유효기한")).toHaveAttribute("type", "date");
  expect(screen.queryByTestId("A-INE-PAID")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "문서 제목" },
  });
  await act(() => flushBeforeNavigation());
  expect(Object.keys(api.save.mock.calls.at(-1)![1]).sort()).toEqual([
    "content",
    "paid",
    "title",
  ]);
});
it("blank PDF-only values are autosaved and missing modal focuses the actual input", async () => {
  await editor();
  fireEvent.change(screen.getByLabelText("수신자 상호"), {
    target: { value: "" },
  });
  await act(() => flushBeforeNavigation());
  expect(api.save.mock.calls[0][1].content.client.name).toBe("");
  expect(Object.keys(api.save.mock.calls[0][1]).sort()).toEqual([
    "content",
    "paid",
    "title",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  const dialog = screen.getByRole("dialog", { name: "빠진 항목" });
  expect(dialog).toHaveTextContent("수신자 · 상호");
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "수신자 · 상호" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("수신자 상호")).toHaveFocus(),
  );
});
it("item editing, VAT, ordering, delete and add immediately share the preview data", async () => {
  await editor();
  fireEvent.change(screen.getByLabelText("1번째 수량"), {
    target: { value: "2" },
  });
  const paper = screen.getByTestId("invoice-paper");
  expect(paper).toHaveTextContent("4,400,000");
  fireEvent.click(screen.getByTestId("invoice-item-down-item-one"));
  const names = within(paper)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);
  expect(names[0]).toContain("디자인");
  fireEvent.click(screen.getByTestId("A-INE-ITEM-DELETE-item-one"));
  expect(within(paper).queryByText("기획")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId("A-INE-ITEM-ADD"));
  expect(screen.getAllByText(/품목 [123]$/)).toHaveLength(3);
  await act(() => flushBeforeNavigation());
  const last = api.save.mock.calls.at(-1)![1];
  expect(new Set(last.content.items.map((i) => i.id)).size).toBe(3);
});
it("fifty items disable adding without removing their preview rows", async () => {
  const doc = testInvoice();
  doc.content.items = Array.from({ length: 50 }, (_, i) => ({
    ...doc.content.items[0],
    id: String(i),
  }));
  api.get.mockResolvedValue(doc);
  await editor();
  expect(screen.getByTestId("A-INE-ITEM-ADD")).toBeDisabled();
  expect(
    within(screen.getByTestId("invoice-paper")).getAllByRole("row"),
  ).toHaveLength(51);
});
it("paid invoice remains editable in both directions and quote has no paid toggle", async () => {
  const doc = testInvoice();
  doc.doc_type = "invoice";
  doc.paid = true;
  api.get.mockResolvedValue(doc);
  await editor();
  expect(
    screen.queryByRole("button", { name: "청구서로 변환" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "입금 후 변경" },
  });
  await act(() => flushBeforeNavigation());
  expect(api.save.mock.calls.at(-1)![1].paid).toBe(true);
  fireEvent.click(screen.getByTestId("A-INE-PAID"));
  await act(() => flushBeforeNavigation());
  expect(api.save.mock.calls.at(-1)![1].paid).toBe(false);
});
it("save failure blocks conversion, back and PDF and keeps the latest dirty values", async () => {
  api.save.mockRejectedValue(new Error("저장 오류"));
  const router = await editor();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "보존" },
  });
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  await screen.findByRole("alert");
  expect(api.convert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "← 목록" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  expect(router.state.location.pathname).toBe("/invoices/27/edit");
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(3));
  expect(document.querySelector("iframe")).toBeNull();
  expect(screen.getByLabelText("제목")).toHaveValue("보존");
});
it("conversion waits for in-flight and subsequent latest edits before calling sibling API", async () => {
  let release!: () => void;
  api.save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  api.convert.mockRejectedValue(new Error("변환 중단"));
  await editor();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "먼저" },
  });
  let flushing!: Promise<void>;
  act(() => {
    flushing = flushBeforeNavigation();
  });
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "최신" },
  });
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  expect(api.convert).not.toHaveBeenCalled();
  await act(async () => {
    release();
    await flushing;
  });
  await waitFor(() => expect(api.convert).toHaveBeenCalledWith("27"));
  expect(api.save.mock.calls.at(-1)![1].title).toBe("최신");
});
it("PDF iframe appears only after latest save and uses selected ID", async () => {
  let release!: () => void;
  api.save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await editor();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "변경" },
  });
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(document.querySelector("iframe")).toBeNull();
  await act(async () => {
    release();
  });
  await waitFor(() =>
    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      "/print/invoice/27",
    ),
  );
});
it("stamp upload updates the same serial snapshot and unlink never deletes photo bytes", async () => {
  vi.mocked(uploadPhoto).mockResolvedValue({ photoId: "owned-stamp" });
  await editor();
  fireEvent.change(screen.getByTestId("A-INE-STAMP-SELECT"), {
    target: {
      files: [new File(["image"], "stamp.png", { type: "image/png" })],
    },
  });
  await screen.findByRole("button", { name: "직인 연결 해제" });
  await act(() => flushBeforeNavigation());
  expect(api.save.mock.calls.at(-1)![1].content.stampPhotoId).toBe(
    "owned-stamp",
  );
  fireEvent.click(screen.getByRole("button", { name: "직인 연결 해제" }));
  await act(() => flushBeforeNavigation());
  expect(api.save.mock.calls.at(-1)![1].content.stampPhotoId).toBeNull();
  expect(api.delete).not.toHaveBeenCalled();
});
it("direct print route does not fetch or print private data", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open("/print/invoice/27");
  expect(screen.getByText(/편집기의 PDF 내보내기/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  expect(print).not.toHaveBeenCalled();
});
it("renderer retains all fifty rows and long notes without inventing missing data", () => {
  const doc = testInvoice();
  doc.content.notes = "긴 비고".repeat(3000);
  doc.content.items = Array.from({ length: 50 }, (_, i) => ({
    ...doc.content.items[0],
    id: String(i),
    name: `품목${i}`,
  }));
  render(<InvoiceRenderer invoice={doc} />);
  expect(screen.getAllByRole("row")).toHaveLength(51);
  expect(screen.getByTestId("invoice-paper").textContent).toContain(
    doc.content.notes,
  );
  expect(screen.queryByAltText("직인")).not.toBeInTheDocument();
});
it("framed print waits for fonts and renders the saved full content before printing once", async () => {
  vi.stubGlobal("self", {});
  let release!: () => void;
  Object.defineProperty(document, "fonts", {
    value: {
      ready: new Promise<void>((resolve) => {
        release = resolve;
      }),
    },
    configurable: true,
  });
  const doc = testInvoice();
  doc.content.notes = "전체 비고".repeat(2000);
  api.get.mockResolvedValue(doc);
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const message = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(() => undefined);
  open("/print/invoice/27");
  await screen.findByTestId("invoice-paper");
  expect(print).not.toHaveBeenCalled();
  await act(async () => release());
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(document.title).toBe("Q-2026-0001_수신자");
  expect(screen.getByTestId("invoice-paper").textContent).toContain(
    doc.content.notes,
  );
  window.dispatchEvent(new Event("afterprint"));
  expect(message).toHaveBeenCalledWith(
    { type: "invoice-print-finished" },
    window.location.origin,
  );
  Object.defineProperty(document, "fonts", {
    value: undefined,
    configurable: true,
  });
});
it("framed print read failure never prints and notifies the parent", async () => {
  vi.stubGlobal("self", {});
  api.get.mockRejectedValue(new Error("조회 실패"));
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const message = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(() => undefined);
  open("/print/invoice/27");
  await screen.findByRole("alert");
  expect(print).not.toHaveBeenCalled();
  expect(message).toHaveBeenCalledWith(
    { type: "invoice-print-error" },
    window.location.origin,
  );
});
it("failed image readiness rejects rather than silently printing an empty stamp", async () => {
  const root = document.createElement("div");
  const image = document.createElement("img");
  root.append(image);
  Object.defineProperty(image, "complete", { value: true });
  Object.defineProperty(image, "naturalWidth", { value: 0 });
  await expect(invoiceImagesReady(root)).rejects.toThrow("직인");
});
