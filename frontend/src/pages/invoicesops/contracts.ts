import type { StyleColor } from "../../shared/contracts";

/** Structural contract shared by the toolbar and print adapter, independent of the editor module. */
export interface InvoiceCopyContent {
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
  items: {
    id: string;
    name: string;
    spec: string;
    qty: number;
    unitPrice: number;
    note: string;
  }[];
  vatMode: "separate" | "included" | "exempt";
  notes: string;
  stampPhotoId: string | null;
  color: StyleColor;
}

export interface InvoiceActionDocument {
  id: string;
  doc_type: "quote" | "invoice";
  doc_no: string;
  title: string;
  content: InvoiceCopyContent;
  paid: boolean;
}

export interface InvoicePrintDocument extends InvoiceActionDocument {
  user_id: string;
  source_quote_id: string | null;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}
