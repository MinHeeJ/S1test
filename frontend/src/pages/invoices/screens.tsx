import type { ScreenRegistration } from "../../app/router";
import InvoicesPage from "./SCR-INVOICES";
import InvoiceEditorPage from "./SCR-INVOICE-EDITOR";
import InvoicePrintPage from "./SCR-INVOICE-PRINT";

export const invoiceScreens: ScreenRegistration[] = [
  { path: "/invoices", element: <InvoicesPage /> },
  { path: "/invoices/:id/edit", element: <InvoiceEditorPage /> },
  { path: "/print/invoice/:id", element: <InvoicePrintPage /> },
];
