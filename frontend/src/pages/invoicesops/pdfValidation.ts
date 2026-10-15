import type { InvoiceCopyContent } from "./contracts";

export interface InvoiceMissingField {
  path: string;
  label: string;
}

/** Draft saving deliberately has no PDF-required-field gate. Only these fields prevent export. */
export function invoicePdfMissing(
  content: InvoiceCopyContent,
): InvoiceMissingField[] {
  const result: InvoiceMissingField[] = [];
  if (!content.supplier.name.trim())
    result.push({ path: "supplier.name", label: "공급자 · 상호" });
  if (!content.client.name.trim())
    result.push({ path: "client.name", label: "수신자 · 상호" });
  if (!content.issueDate)
    result.push({ path: "issueDate", label: "문서 정보 · 발행일" });
  if (!content.items.length)
    result.push({ path: "items", label: "품목 1행 이상" });
  content.items.forEach((item, index) => {
    if (!item.name.trim())
      result.push({
        path: `items.${index}.name`,
        label: `품목 ${index + 1}번째 · 품명`,
      });
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      result.push({
        path: `items.${index}.qty`,
        label: `품목 ${index + 1}번째 · 수량`,
      });
    }
  });
  return result;
}
