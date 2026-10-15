import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { waitForImages } from "../resumes/SC-PRINT";
import type { InvoiceDocument } from "./InvoiceDocument";
import { InvoiceDocumentRenderer } from "./InvoiceDocumentRenderer";
import { invoiceCommands } from "./invoiceCommands";

/** Wait for every resource before opening print; cancellation invalidates even an already-started wait. */
export async function printInvoiceDocument(
  root: HTMLElement,
  invoice: InvoiceDocument,
  cancelled: () => boolean,
) {
  if (document.fonts) {
    await document.fonts.ready;
    document.fonts.forEach((font) => {
      if (font.status === "error")
        throw new Error("인쇄 글꼴을 불러오지 못했습니다.");
    });
  }
  await waitForImages(root);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (cancelled()) return;
  document.title = `${invoice.doc_no}_${invoice.content.client.name}`;
  window.print();
}

/** Protected, shell-free iframe route. Ordinary tabs never request private document data. */
export default function InvoicePrintPage() {
  const { id } = useParams();
  const framed = window.self !== window.top;
  const [invoice, setInvoice] = useState<InvoiceDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setInvoice(null);
    setError(null);
    if (!framed || !id) return;
    void invoiceCommands
      .get(id)
      .then((result) => {
        if (generation.current !== current) return;
        if (
          result.id !== id ||
          !result.content ||
          !Array.isArray(result.content.items)
        ) {
          throw new Error("인쇄 응답 계약을 확인해 주세요.");
        }
        setInvoice(result);
      })
      .catch((failure) => {
        if (generation.current !== current) return;
        setError(failure instanceof Error ? failure.message : "인쇄 조회 실패");
        window.parent.postMessage(
          { type: "invoice-print-error" },
          window.location.origin,
        );
      });
    return () => {
      generation.current++;
    };
  }, [id, framed]);
  useEffect(() => {
    if (!invoice || !root.current) return;
    let cancelled = false;
    const previousTitle = document.title;
    const finished = () =>
      window.parent.postMessage(
        { type: "invoice-print-finished" },
        window.location.origin,
      );
    window.addEventListener("afterprint", finished);
    void printInvoiceDocument(root.current, invoice, () => cancelled).catch(
      (failure) => {
        if (cancelled) return;
        setError(failure instanceof Error ? failure.message : "인쇄 실패");
        window.parent.postMessage(
          { type: "invoice-print-error" },
          window.location.origin,
        );
      },
    );
    return () => {
      cancelled = true;
      document.title = previousTitle;
      window.removeEventListener("afterprint", finished);
    };
  }, [invoice]);
  if (!framed)
    return <p>인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다.</p>;
  if (error)
    return (
      <p role="alert" data-testid="invoice-print-error">
        {error}
      </p>
    );
  if (!invoice) return <p role="status">인쇄 자료 불러오는 중…</p>;
  return (
    <div ref={root} data-testid="invoice-print-screen">
      <InvoiceDocumentRenderer invoice={invoice} />
    </div>
  );
}
