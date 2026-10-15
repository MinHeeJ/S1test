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
import { useState } from "react";
import { InvoiceDocumentActions } from "./InvoiceDocumentActions";
import { InvoiceDuplicateButton } from "./InvoiceDuplicateButton";
import { invoiceCopyApi } from "./invoiceCopyApi";
import { invoicePdfMissing } from "./pdfValidation";
import type { InvoiceActionDocument } from "./contracts";

vi.mock("./invoiceCopyApi", () => ({
  invoiceCopyApi: { convert: vi.fn(), duplicate: vi.fn(), get: vi.fn() },
}));
const api = vi.mocked(invoiceCopyApi);
let latest: InvoiceActionDocument;
let flush: ReturnType<typeof vi.fn<() => Promise<void>>>;
const focusField = vi.fn();

beforeEach(() => {
  latest = {
    id: "27",
    doc_type: "quote",
    doc_no: "Q-2026-0001",
    title: "견적",
    paid: false,
    content: {
      supplier: {
        name: "공급자",
        bizNo: "bad-format",
        ceo: "",
        address: "",
        phone: "",
      },
      client: { name: "수신자", contact: "" },
      issueDate: "2026-01-01",
      validUntil: "",
      items: [
        { id: "a", name: "품목", spec: "", qty: 1, unitPrice: 0, note: "" },
      ],
      vatMode: "separate",
      notes: "",
      stampPhotoId: null,
      color: "#1F3A5F",
    },
  };
  flush = vi.fn().mockResolvedValue(undefined);
  api.convert.mockResolvedValue({ id: "28" });
  api.duplicate.mockResolvedValue({ id: "29" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  document.querySelectorAll("iframe").forEach((frame) => frame.remove());
});

function EditorHarness() {
  const [documentData, setDocumentData] = useState(latest);
  return (
    <>
      <input
        aria-label="수신자 상호"
        defaultValue={latest.content.client.name}
      />
      <InvoiceDocumentActions
        document={documentData}
        getSnapshot={() => latest}
        flush={() => flush()}
        onPaidChange={(paid) => {
          latest = { ...latest, paid };
          setDocumentData(latest);
        }}
        focusField={(path) => {
          focusField(path);
          document
            .querySelector<HTMLInputElement>("input[aria-label='수신자 상호']")
            ?.focus();
        }}
      />
    </>
  );
}
function open() {
  const router = createMemoryRouter(
    [{ path: "/invoices/:id/edit", element: <EditorHarness /> }],
    { initialEntries: ["/invoices/27/edit"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

it("quote offers conversion but not paid, and navigates only after latest flush and POST", async () => {
  let release!: () => void;
  flush.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const router = open();
  expect(
    screen.queryByRole("checkbox", { name: "입금 완료" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  expect(api.convert).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "청구서로 변환" })).toBeDisabled();
  latest.content.items[0].qty = 2;
  await act(async () => release());
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/invoices/28/edit"),
  );
  expect(api.convert).toHaveBeenCalledTimes(1);
  expect(api.convert).toHaveBeenCalledWith("27");
  expect(flush).toHaveBeenCalledTimes(1);
});

it("flush rejection preserves editor and prevents conversion and iframe", async () => {
  flush.mockRejectedValue(new Error("저장 실패"));
  const router = open();
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("저장 실패");
  expect(router.state.location.pathname).toBe("/invoices/27/edit");
  expect(api.convert).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
  flush.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  await waitFor(() => expect(api.convert).toHaveBeenCalledTimes(1));
});

it.each([
  "NOT_A_QUOTE",
  "404",
  "DOCUMENT_NUMBER_CONFLICT",
  "DOCUMENT_NUMBER_EXHAUSTED",
])("conversion rejection %s keeps current route", async (message) => {
  api.convert.mockRejectedValue(new Error(message));
  const router = open();
  fireEvent.click(screen.getByRole("button", { name: "청구서로 변환" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(router.state.location.pathname).toBe("/invoices/27/edit");
});

it("invoice allows paid both ways without clearing content or offering conversion", async () => {
  latest.doc_type = "invoice";
  open();
  expect(
    screen.queryByRole("button", { name: "청구서로 변환" }),
  ).not.toBeInTheDocument();
  const original = structuredClone(latest.content);
  fireEvent.click(screen.getByRole("checkbox", { name: "입금 완료" }));
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: "입금 완료" }),
    ).not.toBeDisabled(),
  );
  expect(latest.paid).toBe(true);
  expect(latest.content).toEqual(original);
  fireEvent.click(screen.getByRole("checkbox", { name: "입금 완료" }));
  await waitFor(() => expect(flush).toHaveBeenCalledTimes(2));
  expect(latest.paid).toBe(false);
});

it("PDF has only CMN-932 required fields; zero unit price and invalid bizNo do not block it", () => {
  expect(invoicePdfMissing(latest.content)).toEqual([]);
  latest.content.items.push({ ...latest.content.items[0], id: "b", qty: 0 });
  expect(invoicePdfMissing(latest.content)).toEqual([
    { path: "items.1.qty", label: "품목 2번째 · 수량" },
  ]);
});

it("missing recipient opens actual location modal, focuses input, and does not save or print", async () => {
  latest.content.client.name = "";
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  open();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  const dialog = screen.getByRole("dialog", { name: "빠진 항목" });
  expect(
    within(dialog).getByRole("button", { name: "수신자 · 상호" }),
  ).toBeInTheDocument();
  expect(flush).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
  expect(print).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "수신자 · 상호" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("수신자 상호")).toHaveFocus(),
  );
  expect(focusField).toHaveBeenCalledWith("client.name");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("PDF displays every distinct required location and closing is not export", () => {
  latest.content.supplier.name = "";
  latest.content.client.name = "";
  latest.content.issueDate = "";
  latest.content.items[0].name = "";
  latest.content.items[0].qty = 0;
  open();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  for (const label of [
    "공급자 · 상호",
    "수신자 · 상호",
    "문서 정보 · 발행일",
    "품목 1번째 · 품명",
    "품목 1번째 · 수량",
  ]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(flush).not.toHaveBeenCalled();
});

it("PDF without items requires a row only at export", () => {
  latest.content.items = [];
  expect(invoicePdfMissing(latest.content)).toEqual([
    { path: "items", label: "품목 1행 이상" },
  ]);
});

it("PDF waits for flush and only trusts same-origin messages from its own frame", async () => {
  let release!: () => void;
  flush.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  expect(document.querySelector("iframe")).toBeNull();
  await act(async () => release());
  const frame = document.querySelector("iframe")!;
  expect(frame).toHaveAttribute("src", "/print/invoice/27");
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://untrusted.invalid",
        source: frame.contentWindow,
        data: { type: "invoice-print-finished" },
      }),
    );
  });
  expect(frame.isConnected).toBe(true);
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: frame.contentWindow,
        data: { type: "invoice-print-error" },
      }),
    );
  });
  expect(frame.isConnected).toBe(false);
  expect(await screen.findByRole("alert")).toHaveTextContent("인쇄 자료");
});

it("PDF flush failure leaves no frame", async () => {
  flush.mockRejectedValue(new Error("저장 실패"));
  open();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  await screen.findByRole("alert");
  expect(document.querySelector("iframe")).toBeNull();
});

it("PDF revalidates the latest content changed during flush", async () => {
  let release!: () => void;
  flush.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "PDF 내보내기" }));
  latest.content.client.name = "";
  await act(async () => release());
  expect(screen.getByRole("dialog")).toHaveTextContent("수신자 · 상호");
  expect(document.querySelector("iframe")).toBeNull();
});

it("duplicate uses the selected ID, stops row navigation, prevents repeated clicks and refreshes", async () => {
  const row = vi.fn();
  const refreshed = vi.fn();
  let release!: (result: { id: string }) => void;
  api.duplicate.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  render(
    <div onClick={row}>
      <InvoiceDuplicateButton id="52" onDuplicated={refreshed} />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  expect(row).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "복제 중…" })).toBeDisabled();
  expect(api.duplicate).toHaveBeenCalledTimes(1);
  expect(api.duplicate).toHaveBeenCalledWith("52");
  await act(async () => release({ id: "53" }));
  expect(refreshed).toHaveBeenCalledWith({ id: "53" });
});

it("duplicate 404 shows error and does not report refresh success", async () => {
  const refreshed = vi.fn();
  api.duplicate.mockRejectedValue(new Error("문서를 찾을 수 없습니다."));
  render(<InvoiceDuplicateButton id="52" onDuplicated={refreshed} />);
  fireEvent.click(screen.getByRole("button", { name: "복제" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "문서를 찾을 수 없습니다.",
  );
  expect(refreshed).not.toHaveBeenCalled();
});
