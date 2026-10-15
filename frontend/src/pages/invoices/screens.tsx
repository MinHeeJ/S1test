import InvoicesPage from "./SCR-INVOICES";
import InvoiceEditorPage from "./SCR-INVOICE-EDITOR";
import InvoicePrintPage from "./SCR-INVOICE-PRINT";

/** The shared wiring owner registers these protected routes and iframe-only print admission. */
export const invoiceScreens = [
  { path: "/invoices" as const, element: <InvoicesPage /> },
  { path: "/invoices/:id/edit" as const, element: <InvoiceEditorPage /> },
  { path: "/print/invoice/:id" as const, element: <InvoicePrintPage /> },
];
