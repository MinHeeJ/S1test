import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { invoicesApi } from "./invoicesApi";
import type { Invoice } from "./contracts";
import { InvoiceRenderer } from "./InvoiceRenderer";

export async function invoiceImagesReady(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(
      (image) =>
        new Promise<void>((resolve, reject) => {
          if (image.complete) {
            if (image.naturalWidth > 0) resolve();
            else reject(new Error("직인을 불러오지 못했습니다."));
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error("직인을 불러오지 못했습니다.")),
            { once: true },
          );
        }),
    ),
  );
}

/** Private fetch and print are iframe-only; failures notify the owning frame without printing. */
export default function InvoicePrintPage() {
  const { id } = useParams();
  const framed = window.self !== window.top;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!framed || !id) return;
    let active = true;
    void invoicesApi
      .get(id)
      .then((value) => {
        if (active) setInvoice(value);
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        window.parent.postMessage(
          { type: "invoice-print-error" },
          window.location.origin,
        );
      });
    return () => {
      active = false;
    };
  }, [framed, id]);
  useEffect(() => {
    if (!invoice || !root.current || !framed) return;
    let active = true;
    const done = () =>
      window.parent.postMessage(
        { type: "invoice-print-finished" },
        window.location.origin,
      );
    window.addEventListener("afterprint", done);
    void (async () => {
      try {
        if (document.fonts) await document.fonts.ready;
        await invoiceImagesReady(root.current!);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (!active) return;
        document.title = `${invoice.doc_no}_${invoice.content.client.name}`;
        window.print();
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "인쇄 준비 실패");
        window.parent.postMessage(
          { type: "invoice-print-error" },
          window.location.origin,
        );
      }
    })();
    return () => {
      active = false;
      window.removeEventListener("afterprint", done);
    };
  }, [invoice, framed]);
  if (!framed)
    return <p>인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!invoice) return <p role="status">인쇄 자료 불러오는 중…</p>;
  return (
    <div ref={root} className="invoice-print" data-testid="invoice-print-page">
      <InvoiceRenderer invoice={invoice} saved />
    </div>
  );
}
