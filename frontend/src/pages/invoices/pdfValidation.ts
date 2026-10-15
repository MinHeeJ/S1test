import type { InvoiceContent } from "./contracts";
export interface InvoiceMissingField {
  label: string;
  id: string;
}
export function missingFields(c: InvoiceContent): InvoiceMissingField[] {
  const missing: InvoiceMissingField[] = [];
  if (!c.supplier.name.trim())
    missing.push({ label: "공급자 · 상호", id: "supplier-name" });
  if (!c.client.name.trim())
    missing.push({ label: "수신자 · 상호", id: "client-name" });
  if (!c.issueDate) missing.push({ label: "발행일", id: "issue-date" });
  if (!c.items.length) missing.push({ label: "품목 1행 이상", id: "add-item" });
  c.items.forEach((item, index) => {
    if (!item.name.trim())
      missing.push({
        label: `품목 ${index + 1} · 품명`,
        id: `item-${item.id}-name`,
      });
    if (item.qty < 1)
      missing.push({
        label: `품목 ${index + 1} · 수량`,
        id: `item-${item.id}-qty`,
      });
  });
  return missing;
}
