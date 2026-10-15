import type { InvoicePrintContent } from "./InvoiceDocument";

export interface InvoiceMissingField {
  path: string;
  label: string;
}

/** Save accepts incomplete drafts; only export asks for these five kinds of required input. */
export function invoicePdfMissing(
  content: InvoicePrintContent,
): InvoiceMissingField[] {
  const missing: InvoiceMissingField[] = [];
  const add = (path: string, label: string) => missing.push({ path, label });
  if (!content.supplier.name.trim()) add("supplier.name", "공급자 · 상호");
  if (!content.client.name.trim()) add("client.name", "수신자 · 상호");
  if (!content.issueDate) add("issueDate", "문서 정보 · 발행일");
  if (!content.items.length) add("items", "품목 1행 이상");
  content.items.forEach((item, index) => {
    if (!item.name.trim())
      add(`items.${index}.name`, `품목 ${index + 1}번째 · 품명`);
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      add(`items.${index}.qty`, `품목 ${index + 1}번째 · 수량`);
    }
  });
  return missing;
}
