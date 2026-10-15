import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { waitForImages } from "../resumes/SC-PRINT";
import { invoiceCopyApi } from "./invoiceCopyApi";
import type { InvoicePrintDocument } from "./contracts";
import "./invoiceActions.css";

export interface InvoicePrintPageProps {
  /** Supply the editor's actual A4 renderer; ready means all pages and stamp image nodes are mounted. */
  renderDocument: (
    document: InvoicePrintDocument,
    ready: () => void,
  ) => ReactNode;
}

/** Print lifecycle only: the owning editor supplies its renderer so preview and PDF cannot diverge. */
export default function InvoicePrintPage({
  renderDocument,
}: InvoicePrintPageProps) {
  const { id } = useParams();
  const framed = window.self !== window.top;
  const [documentData, setDocumentData] = useState<InvoicePrintDocument | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const lifecycle = useRef({ cancelled: false, started: false });
  const notify = (type: string) =>
    window.parent.postMessage({ type }, window.location.origin);

  useEffect(() => {
    const session = { cancelled: false, started: false };
    lifecycle.current = session;
    setDocumentData(null);
    setError(null);
    if (!framed || !id) return;
    const title = document.title;
    const finished = () => notify("invoice-print-finished");
    window.addEventListener("afterprint", finished);
    void invoiceCopyApi
      .get(id)
      .then((result) => {
        if (session.cancelled) return;
        if (
          result.id !== id ||
          result.deleted ||
          !result.content ||
          !Array.isArray(result.content.items)
        ) {
          throw new Error("인쇄 응답 계약을 확인해 주세요.");
        }
        setDocumentData(result);
      })
      .catch((failure) => {
        if (session.cancelled) return;
        setError(failure instanceof Error ? failure.message : "인쇄 조회 실패");
        notify("invoice-print-error");
      });
    return () => {
      session.cancelled = true;
      document.title = title;
      window.removeEventListener("afterprint", finished);
    };
  }, [id, framed]);

  const ready = useCallback(async () => {
    const session = lifecycle.current;
    if (!root.current || !documentData || session.started || session.cancelled)
      return;
    session.started = true;
    try {
      if (document.fonts) await document.fonts.ready;
      if (session.cancelled || !root.current) return;
      if (
        documentData.content.stampPhotoId &&
        !root.current.querySelector("img")
      ) {
        throw new Error("직인 이미지를 불러오지 못했습니다.");
      }
      await waitForImages(root.current);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (session.cancelled) return;
      document.title = `${documentData.doc_no}_${documentData.content.client.name}`;
      window.print();
    } catch (failure) {
      if (session.cancelled) return;
      setError(failure instanceof Error ? failure.message : "인쇄 실패");
      notify("invoice-print-error");
    }
  }, [documentData]);

  if (!framed)
    return <p>인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!documentData) return <p role="status">인쇄 자료 불러오는 중…</p>;
  return (
    <div ref={root} className="print-document" data-testid="invoice-print-page">
      {renderDocument(documentData, () => {
        void ready();
      })}
    </div>
  );
}
