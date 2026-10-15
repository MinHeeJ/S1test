import { useRef, useState } from "react";
import { invoiceCopyApi } from "./invoiceCopyApi";
import "./invoiceActions.css";

/** Embeds in the existing row menu; success refreshes that same filtered page, not a synthetic list. */
export function InvoiceDuplicateButton({
  id,
  onDuplicated,
}: {
  id: string;
  onDuplicated: (created: { id: string }) => Promise<void> | void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function duplicate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const created = await invoiceCopyApi.duplicate(id);
      await onDuplicated(created);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "복제하지 못했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <span
      className="invoice-document-actions"
      data-testid={`invoice-duplicate-${id}`}
    >
      <button
        type="button"
        data-testid={`A-INV-DUPLICATE-${id}`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          void duplicate();
        }}
      >
        {busy ? "복제 중…" : "복제"}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
