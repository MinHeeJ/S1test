export type InvoiceDocType = "quote" | "invoice";
export type InvoiceVatMode = "separate" | "included" | "exempt";
export const invoiceColors = [
  "#1F3A5F",
  "#2563EB",
  "#0F766E",
  "#9F1239",
  "#C2410C",
  "#374151",
] as const;
export interface InvoiceItem {
  id: string;
  name: string;
  spec: string;
  qty: number;
  unitPrice: number;
  note: string;
}
export interface InvoiceContent {
  supplier: {
    name: string;
    bizNo: string;
    ceo: string;
    address: string;
    phone: string;
  };
  client: { name: string; contact: string };
  issueDate: string;
  validUntil?: string;
  dueDate?: string;
  bankAccount?: string;
  items: InvoiceItem[];
  vatMode: InvoiceVatMode;
  notes: string;
  stampPhotoId: string | null;
  color: string;
}
export interface InvoiceWrite {
  title: string;
  content: InvoiceContent;
  paid: boolean;
}
export interface Invoice extends InvoiceWrite {
  id: string;
  user_id: string;
  doc_type: InvoiceDocType;
  doc_no: string;
  source_quote_id: string | null;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}
export interface InvoicePage {
  items: Invoice[];
  page: number;
  size: number;
  total: number;
}
export const invoiceSnapshot = (invoice: Invoice): InvoiceWrite => ({
  title: invoice.title,
  content: invoice.content,
  paid: invoice.paid,
});
