import type { StyleColor } from "../../shared/contracts";

export type InvoiceDocType = "quote" | "invoice";
export type InvoiceVatMode = "separate" | "included" | "exempt";
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
  color: StyleColor;
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
export const invoiceSnapshot = (value: Invoice): InvoiceWrite => ({
  title: value.title,
  content: value.content,
  paid: value.paid,
});
