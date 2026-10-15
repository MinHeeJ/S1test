import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Invoice } from "./contracts";
import { invoicesApi } from "./invoicesApi";
import { InvoiceRenderer } from "./InvoiceRenderer";

/** Failed fonts, images or private reads stop printing; a direct tab never fetches private content. */
export default function InvoicePrintPage() {
  const { id } = useParams();
  const framed = window.self !== window.top;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    setInvoice(null);
    setError(null);
    if (!framed || !id) return;
    void invoicesApi
      .get(id)
      .then((result) => {
        if (result.id !== id)
          throw new Error("인쇄 응답 계약을 확인해 주세요.");
        if (!cancelled) setInvoice(result);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "인쇄 조회 실패");
          window.parent.postMessage(
            { type: "invoice-print-error" },
            window.location.origin,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, framed]);
  useEffect(() => {
    let cancelled = false;
    if (!invoice || !root.current) return;
    const finished = () =>
      window.parent.postMessage(
        { type: "invoice-print-finished" },
        window.location.origin,
      );
    void (async () => {
      try {
        if (document.fonts) await document.fonts.ready;
        await invoiceImagesReady(root.current!);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (cancelled) return;
        document.title = `${invoice.doc_no}_${invoice.content.client.name}`;
        window.addEventListener("afterprint", finished, { once: true });
        window.print();
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "인쇄 실패");
          window.parent.postMessage(
            { type: "invoice-print-error" },
            window.location.origin,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", finished);
    };
  }, [invoice]);
  if (!framed)
    return <p>인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!invoice) return <p role="status">인쇄 자료 불러오는 중…</p>;
  return (
    <div
      className="invoice-print-document"
      data-testid="invoice-print"
      ref={root}
    >
      <InvoiceRenderer invoice={invoice} />
    </div>
  );
}

export async function invoiceImagesReady(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(
      (image) =>
        new Promise<void>((resolve, reject) => {
          if (image.complete) {
            if (image.naturalWidth) resolve();
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
