import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InvoiceActionDocument } from "./contracts";
import { invoiceCopyApi } from "./invoiceCopyApi";
import { invoicePdfMissing, type InvoiceMissingField } from "./pdfValidation";
import "./invoiceActions.css";

export interface InvoiceDocumentActionsProps {
  document: InvoiceActionDocument;
  /** Reads the live editor ref, not a render-time closure, including changes during a PUT. */
  getSnapshot: () => InvoiceActionDocument;
  /** The editor's existing serial queue must resolve only after every latest snapshot is saved. */
  flush: () => Promise<void>;
  onPaidChange: (paid: boolean) => void;
  focusField: (path: string) => void;
}

/** Shared editor toolbar region: no second editor state or independent autosave queue is introduced. */
export function InvoiceDocumentActions(props: InvoiceDocumentActionsProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<InvoiceMissingField[] | null>(null);
  const cleanupFrame = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const dialog = useRef<HTMLDivElement>(null);
  const id = props.document.id;

  useEffect(() => {
    const current = ++generation.current;
    pending.current = false;
    setBusy(false);
    setError(null);
    setMissing(null);
    return () => {
      if (generation.current === current) generation.current++;
      cleanupFrame.current?.();
    };
  }, [id]);

  useEffect(() => {
    if (!missing) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, [missing]);

  async function run(action: "convert" | "paid" | "pdf") {
    if (pending.current) return;
    if (action === "pdf") {
      const fields = invoicePdfMissing(props.getSnapshot().content);
      if (fields.length) {
        setMissing(fields);
        return;
      }
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    const current = generation.current;
    let printing = false;
    try {
      if (action === "paid") props.onPaidChange(!props.getSnapshot().paid);
      await props.flush();
      if (current !== generation.current) return;
      if (action === "convert") {
        const result = await invoiceCopyApi.convert(id);
        if (current === generation.current)
          navigate(`/invoices/${encodeURIComponent(result.id)}/edit`);
      } else if (action === "pdf") {
        // Input may have changed while an earlier snapshot was in flight.
        const fields = invoicePdfMissing(props.getSnapshot().content);
        if (fields.length) {
          setMissing(fields);
          return;
        }
        const frame = document.createElement("iframe");
        frame.title = "견적서·청구서 인쇄";
        frame.className = "invoice-print-frame";
        frame.src = `/print/invoice/${encodeURIComponent(id)}`;
        const finish = () => {
          frame.remove();
          window.removeEventListener("message", receive);
          cleanupFrame.current = null;
          if (current === generation.current) {
            pending.current = false;
            setBusy(false);
          }
        };
        const receive = (event: MessageEvent) => {
          if (
            event.origin !== window.location.origin ||
            event.source !== frame.contentWindow
          )
            return;
          if (event.data?.type === "invoice-print-error") {
            setError("인쇄 자료를 불러오지 못했습니다.");
            finish();
          } else if (event.data?.type === "invoice-print-finished") finish();
        };
        frame.onerror = () => {
          setError("인쇄 화면을 열지 못했습니다.");
          finish();
        };
        cleanupFrame.current = finish;
        window.addEventListener("message", receive);
        document.body.appendChild(frame);
        printing = true;
      }
    } catch (failure) {
      if (current === generation.current) {
        setError(
          failure instanceof Error
            ? failure.message
            : "요청을 처리하지 못했습니다.",
        );
      }
    } finally {
      if (!printing && current === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  function focus(field: InvoiceMissingField) {
    setMissing(null);
    // Restore the modal's prior focus before selecting the requested input.
    requestAnimationFrame(() => props.focusField(field.path));
  }

  return (
    <div
      className="invoice-document-actions"
      data-testid="invoice-document-actions"
    >
      {props.document.doc_type === "quote" ? (
        <button
          type="button"
          data-testid="A-INE-CONVERT"
          disabled={busy}
          onClick={() => {
            void run("convert");
          }}
        >
          청구서로 변환
        </button>
      ) : (
        <label>
          <input
            type="checkbox"
            data-testid="A-INE-PAID"
            checked={props.document.paid}
            disabled={busy}
            onChange={() => {
              void run("paid");
            }}
          />
          입금 완료
        </label>
      )}
      <button
        type="button"
        data-testid="A-INE-PDF"
        disabled={busy}
        onClick={() => {
          void run("pdf");
        }}
      >
        {busy ? "처리 중…" : "PDF 내보내기"}
      </button>
      {error && <p role="alert">{error}</p>}
      {missing && (
        <div className="modal-overlay">
          <div
            ref={dialog}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-missing-title"
            data-testid="invoice-missing-dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") setMissing(null);
              if (event.key !== "Tab") return;
              const buttons = Array.from(
                dialog.current?.querySelectorAll<HTMLButtonElement>("button") ??
                  [],
              );
              const first = buttons[0];
              const last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <h2 id="invoice-missing-title">빠진 항목</h2>
            <div className="invoice-missing-list">
              {missing.map((field) => (
                <button
                  type="button"
                  key={field.path}
                  data-testid={`A-INE-MISSING-FOCUS-${field.path.replaceAll(".", "-")}`}
                  onClick={() => focus(field)}
                >
                  {field.label}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                data-testid="A-INE-MISSING-CLOSE"
                onClick={() => setMissing(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
