export interface InvoicePrintContent {
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
  bankAccount?: string;
  stampPhotoId: string | null;
  color: string;
}

/** Structural boundary shared by the action toolbar, stored print document and live preview. */
export interface InvoiceDocument {
  id: string;
  doc_type: "quote" | "invoice";
  doc_no: string;
  title: string;
  content: InvoicePrintContent;
  paid: boolean;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
}
