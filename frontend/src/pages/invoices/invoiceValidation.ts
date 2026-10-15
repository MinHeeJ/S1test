import type { InvoiceContent } from "./contracts";

export interface InvoiceMissingField {
  label: string;
  id: string;
}
export function invoiceMissingFields(
  content: InvoiceContent,
): InvoiceMissingField[] {
  const missing: InvoiceMissingField[] = [];
  if (!content.supplier.name.trim())
    missing.push({ label: "공급자 · 상호", id: "supplier-name" });
  if (!content.client.name.trim())
    missing.push({ label: "수신자 · 상호", id: "client-name" });
  if (!content.issueDate)
    missing.push({ label: "문서 정보 · 발행일", id: "issueDate" });
  if (!content.items.length)
    missing.push({ label: "품목 1행 이상", id: "add-item" });
  content.items.forEach((item, i) => {
    if (!item.name.trim())
      missing.push({
        label: `품목 ${i + 1}번째 · 품명`,
        id: `item-${item.id}-name`,
      });
    if (item.qty < 1)
      missing.push({
        label: `품목 ${i + 1}번째 · 수량`,
        id: `item-${item.id}-qty`,
      });
  });
  return missing;
}

export function invoiceInteger(value: string, maximum: number): number | null {
  if (value === "") return 0;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= maximum ? number : null;
}
