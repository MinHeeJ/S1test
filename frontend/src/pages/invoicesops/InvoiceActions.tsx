import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiRequestError } from "../../shared/apiClient";
import { useToastStore } from "../../shared/Toast";
import type { InvoiceDocument } from "./InvoiceDocument";
import { invoiceCommands } from "./invoiceCommands";
import {
  invoicePdfMissing,
  type InvoiceMissingField,
} from "./invoicePdfMissing";

export interface InvoiceActionsProps {
  invoice: InvoiceDocument;
  /** Must flush the editor's one revision-aware queue, including changes arriving during PUT. */
  flush: () => Promise<void>;
  /** Updates local state AND that same queue synchronously; never performs a parallel PUT. */
  onPaidChange: (paid: boolean) => void;
  onFocusField: (path: string) => void;
  onUnavailable?: () => void;
}

/** Toolbar to compose into the invoice editor; no independent save lane or shadow editor state. */
export function InvoiceActions({
  invoice,
  flush,
  onPaidChange,
  onFocusField,
  onUnavailable,
}: InvoiceActionsProps) {
  const navigate = useNavigate();
  const notify = useToastStore((state) => state.show);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const [printing, setPrinting] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const [missing, setMissing] = useState<InvoiceMissingField[] | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (missing)
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [missing]);
  useEffect(() => {
    if (!printing) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (
        !["invoice-print-error", "invoice-print-finished"].includes(
          event.data?.type,
        )
      )
        return;
      if (event.data.type === "invoice-print-error")
        notify("인쇄 준비에 실패했습니다. 다시 시도해 주세요.");
      setPrinting(false);
      locked.current = false;
      setBusy(false);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [printing, notify]);

  function fail(error: unknown) {
    if (error instanceof ApiRequestError && [401, 404].includes(error.status)) {
      setUnavailable(true);
      onUnavailable?.();
      if (error.status === 401) navigate("/login", { replace: true });
    }
    notify(
      error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
    );
  }
  async function run(action: "convert" | "pdf" | "paid", paid?: boolean) {
    if (locked.current) return;
    if (action === "pdf") {
      const fields = invoicePdfMissing(invoice.content);
      if (fields.length) {
        setMissing(fields);
        return;
      }
    }
    locked.current = true;
    setBusy(true);
    let keepBusy = false;
    try {
      if (action === "paid") onPaidChange(paid!);
      await flush();
      if (!mounted.current) return;
      if (action === "convert") {
        const created = await invoiceCommands.convert(invoice.id);
        if (!mounted.current) return;
        // Observe the real created snapshot before moving; failures retain the original edit context.
        await invoiceCommands.get(created.id);
        if (mounted.current)
          navigate(`/invoices/${encodeURIComponent(created.id)}/edit`);
      } else if (action === "pdf") {
        keepBusy = true;
        setPrinting(true);
      }
    } catch (error) {
      if (mounted.current) fail(error);
    } finally {
      if (!keepBusy) {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  function closeMissing(path?: string) {
    setMissing(null);
    if (path) onFocusField(path);
    else exportButton.current?.focus();
  }
  if (unavailable) return <p role="alert">문서를 표시할 수 없습니다.</p>;
  return (
    <div className="toolbar" data-testid="invoice-actions">
      {invoice.doc_type === "quote" ? (
        <button
          type="button"
          data-testid="invoice-convert"
          disabled={busy}
          onClick={() => void run("convert")}
        >
          청구서로 변환
        </button>
      ) : (
        <label>
          <input
            type="checkbox"
            data-testid="invoice-paid"
            checked={invoice.paid}
            disabled={busy}
            onChange={(event) => void run("paid", event.target.checked)}
          />
          입금 완료
        </label>
      )}
      <button
        type="button"
        ref={exportButton}
        data-testid="invoice-export"
        disabled={busy}
        onClick={() => void run("pdf")}
      >
        {printing ? "출력 준비 중…" : "PDF 내보내기"}
      </button>
      {printing && (
        <iframe
          ref={frame}
          title="견적서·청구서 인쇄"
          src={`/print/invoice/${encodeURIComponent(invoice.id)}`}
          style={{ position: "fixed", width: 0, height: 0, border: 0 }}
          aria-hidden="true"
          data-testid="invoice-print-frame"
        />
      )}
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
              if (event.key === "Escape") closeMissing();
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
            <ul>
              {missing.map((field) => (
                <li
                  key={field.path}
                  data-testid={`invoice-missing-${field.path.replaceAll(".", "-")}`}
                >
                  <button
                    type="button"
                    data-testid={`invoice-focus-${field.path.replaceAll(".", "-")}`}
                    onClick={() => closeMissing(field.path)}
                  >
                    {field.label}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              data-testid="invoice-missing-close"
              onClick={() => closeMissing()}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** List duplication refreshes the same list; it never invents the copied row locally. */
export function InvoiceDuplicateButton({
  id,
  onDuplicated,
}: {
  id: string;
  onDuplicated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const notify = useToastStore((state) => state.show);
  return (
    <button
      type="button"
      data-testid={`invoice-duplicate-${id}`}
      disabled={busy}
      onClick={async () => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        try {
          await invoiceCommands.duplicate(id);
          await onDuplicated();
        } catch (error) {
          notify(
            error instanceof Error ? error.message : "복제에 실패했습니다.",
          );
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      복제
    </button>
  );
}
