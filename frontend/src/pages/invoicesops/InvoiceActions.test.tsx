import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InvoiceActions, InvoiceDuplicateButton } from "./InvoiceActions";
import type { InvoiceDocument } from "./InvoiceDocument";
import { invoiceCommands } from "./invoiceCommands";
import { invoicePdfMissing } from "./invoicePdfMissing";
import {
  InvoiceDocumentRenderer,
  invoiceKoreanAmount,
} from "./InvoiceDocumentRenderer";
import InvoicePrintPage, { printInvoiceDocument } from "./SCR-INVOICE-PRINT";

vi.mock("./invoiceCommands", () => ({
  invoiceCommands: { get: vi.fn(), convert: vi.fn(), duplicate: vi.fn() },
}));
const api = vi.mocked(invoiceCommands);
const fixture = (): InvoiceDocument => ({
  id: "12",
  title: "견적",
  doc_type: "quote",
  doc_no: "Q-2026-0001",
  paid: false,
  supply_amount: 3000000,
  vat_amount: 300000,
  total_amount: 3300000,
  content: {
    supplier: { name: "지우", bizNo: "", ceo: "", address: "", phone: "" },
    client: { name: "수신", contact: "" },
    issueDate: "2026-01-01",
    validUntil: "",
    items: [
      {
        id: "item",
        name: "기획",
        spec: "",
        qty: 1,
        unitPrice: 3000000,
        note: "",
      },
    ],
    vatMode: "separate",
    notes: "",
    bankAccount: "",
    stampPhotoId: null,
    color: "#1F3A5F",
  },
});
beforeEach(() => {
  api.convert.mockResolvedValue({ id: "24" });
  api.duplicate.mockResolvedValue({ id: "24" });
  api.get.mockResolvedValue({ ...fixture(), id: "24", doc_type: "invoice" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function open(
  invoice = fixture(),
  flush = vi.fn().mockResolvedValue(undefined),
) {
  const paid = vi.fn();
  const focus = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/invoices/:id/edit",
        element: (
          <InvoiceActions
            invoice={invoice}
            flush={flush}
            onPaidChange={paid}
            onFocusField={focus}
          />
        ),
      },
    ],
    { initialEntries: ["/invoices/12/edit"] },
  );
  render(<RouterProvider router={router} />);
  return { router, paid, focus, flush };
}

it("editor flushes, converts the selected ID, reads the new document and navigates", async () => {
  let finish!: () => void;
  const flush = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { router } = open(fixture(), flush);
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  expect(api.convert).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "청구서로 변환" })).toBeDisabled();
  await act(async () => finish());
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/invoices/24/edit"),
  );
  expect(api.convert).toHaveBeenCalledOnce();
  expect(api.convert).toHaveBeenCalledWith("12");
  expect(api.get).toHaveBeenCalledOnce();
  expect(api.get).toHaveBeenCalledWith("24");
});
it("failed flush prevents conversion, navigation and iframe creation", async () => {
  const { router } = open(
    fixture(),
    vi.fn().mockRejectedValue(new Error("저장 실패")),
  );
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "청구서로 변환" }),
    ).not.toBeDisabled(),
  );
  expect(api.convert).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe("/invoices/12/edit");
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "PDF 내보내기" }),
    ).not.toBeDisabled(),
  );
  expect(screen.queryByTitle("견적서·청구서 인쇄")).not.toBeInTheDocument();
});
it("failed conversion keeps the existing edit context", async () => {
  api.convert.mockRejectedValue(new Error("NOT_A_QUOTE"));
  const { router } = open();
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  await waitFor(() => expect(api.convert).toHaveBeenCalledOnce());
  expect(api.get).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe("/invoices/12/edit");
});
it("invoice paid toggle is reversible through the same queue and does not hide PDF", async () => {
  const { paid, flush } = open({
    ...fixture(),
    doc_type: "invoice",
    paid: true,
  });
  expect(
    screen.queryByRole("button", { name: "청구서로 변환" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "입금 완료" }));
  expect(paid).toHaveBeenCalledWith(false);
  await waitFor(() => expect(flush).toHaveBeenCalledOnce());
  expect(
    screen.getByRole("button", { name: "PDF 내보내기" }),
  ).toBeInTheDocument();
});
it("missing export opens actual ordered labels and focuses selected field without saving or framing", () => {
  const invoice = fixture();
  invoice.content.client.name = "";
  invoice.content.items.push({
    ...invoice.content.items[0],
    id: "second",
    qty: 0,
  });
  const { focus, flush } = open(invoice);
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "수신자 · 상호" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "품목 2번째 · 수량" }));
  expect(focus).toHaveBeenCalledWith("items.1.qty");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(flush).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
});
it("unit price, business number, deadlines and account are not export requirements", () => {
  const invoice = fixture();
  invoice.content.items[0].unitPrice = 0;
  invoice.content.supplier.bizNo = "invalid";
  expect(invoicePdfMissing(invoice.content)).toEqual([]);
  invoice.content.supplier.name = "";
  invoice.content.issueDate = "";
  invoice.content.items = [];
  expect(invoicePdfMissing(invoice.content).map((field) => field.path)).toEqual(
    ["supplier.name", "issueDate", "items"],
  );
});
it("successful export mounts only after flush and ignores messages from an unrelated window", async () => {
  const { flush } = open();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  const frame = await screen.findByTitle("견적서·청구서 인쇄");
  expect(flush).toHaveBeenCalledOnce();
  expect(frame).toHaveAttribute("src", "/print/invoice/12");
  fireEvent(
    window,
    new MessageEvent("message", {
      origin: window.location.origin,
      source: window,
      data: { type: "invoice-print-finished" },
    }),
  );
  expect(frame).toBeInTheDocument();
  fireEvent(
    window,
    new MessageEvent("message", {
      origin: window.location.origin,
      source: (frame as HTMLIFrameElement).contentWindow,
      data: { type: "invoice-print-finished" },
    }),
  );
  await waitFor(() => expect(frame).not.toBeInTheDocument());
});
it("duplicate refreshes real list after selected-ID request and prevents double submission", async () => {
  let finish!: () => void;
  api.duplicate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ id: "24" });
      }),
  );
  const refreshed = vi.fn().mockResolvedValue(undefined);
  render(<InvoiceDuplicateButton id="12" onDuplicated={refreshed} />);
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  expect(api.duplicate).toHaveBeenCalledOnce();
  expect(api.duplicate).toHaveBeenCalledWith("12");
  expect(refreshed).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(refreshed).toHaveBeenCalledOnce();
});
it("failed duplicate never refreshes as success", async () => {
  api.duplicate.mockRejectedValue(new Error("404"));
  const refreshed = vi.fn();
  render(<InvoiceDuplicateButton id="12" onDuplicated={refreshed} />);
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "복제" })).not.toBeDisabled(),
  );
  expect(refreshed).not.toHaveBeenCalled();
});
it("direct print tab does not fetch private data", () => {
  const router = createMemoryRouter(
    [{ path: "/print/invoice/:id", element: <InvoicePrintPage /> }],
    {
      initialEntries: ["/print/invoice/12"],
    },
  );
  render(<RouterProvider router={router} />);
  expect(screen.getByText(/편집기의 PDF 내보내기에서만/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
it("renderer retains all 50 ordered rows and long notes with no stamp for null photo", () => {
  const invoice = fixture();
  invoice.content.items = Array.from({ length: 50 }, (_, index) => ({
    ...invoice.content.items[0],
    id: `item-${index}`,
    name: `품목 ${index + 1}`,
  }));
  invoice.content.notes = "긴 비고\n".repeat(200) + "마지막 비고";
  render(<InvoiceDocumentRenderer invoice={invoice} />);
  expect(screen.getAllByRole("row")).toHaveLength(51);
  expect(screen.getByText("품목 50")).toBeInTheDocument();
  expect(screen.getByText(/마지막 비고/)).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("renderer uses dedicated contain stamp and invoice-only account", () => {
  const invoice = fixture();
  invoice.doc_type = "invoice";
  invoice.content.stampPhotoId = "photo-id";
  invoice.content.bankAccount = "저장 계좌";
  render(<InvoiceDocumentRenderer invoice={invoice} />);
  expect(screen.getByAltText("공급자 직인")).toHaveAttribute(
    "src",
    "/api/photos/photo-id",
  );
  expect(screen.getByText("입금 계좌: 저장 계좌")).toBeInTheDocument();
});
it.each([
  [0, "일금 영원정"],
  [3300000, "일금 삼백삼십만원정"],
  [15000, "일금 일만오천원정"],
  [100010000, "일금 일억일만원정"],
])("Korean grouping for %s", (amount, expected) => {
  expect(invoiceKoreanAmount(amount)).toBe(expected);
});
it("print waits for fonts then images and sets current number/client title", async () => {
  const root = document.createElement("div");
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { value: false });
  root.append(image);
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const promise = printInvoiceDocument(root, fixture(), () => false);
  await Promise.resolve();
  expect(print).not.toHaveBeenCalled();
  image.dispatchEvent(new Event("load"));
  await promise;
  expect(print).toHaveBeenCalledOnce();
  expect(document.title).toBe("Q-2026-0001_수신");
});
it("broken image prevents print", async () => {
  const root = document.createElement("div");
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { value: true });
  Object.defineProperty(image, "naturalWidth", { value: 0 });
  root.append(image);
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  await expect(
    printInvoiceDocument(root, fixture(), () => false),
  ).rejects.toThrow("사진");
  expect(print).not.toHaveBeenCalled();
});
it("failed fonts and cancelled preparation never print", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const root = document.createElement("div");
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts");
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.reject(new Error("fonts failed")) },
  });
  await expect(
    printInvoiceDocument(root, fixture(), () => false),
  ).rejects.toThrow("fonts failed");
  if (fonts) Object.defineProperty(document, "fonts", fonts);
  else Reflect.deleteProperty(document, "fonts");
  await printInvoiceDocument(
    document.createElement("div"),
    fixture(),
    () => true,
  );
  expect(print).not.toHaveBeenCalled();
});
