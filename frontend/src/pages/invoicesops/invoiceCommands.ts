import { apiClient } from "../../shared/apiClient";
import type { InvoiceDocument } from "./InvoiceDocument";

const resource = (id: string) => `/api/invoices/${encodeURIComponent(id)}`;

export const invoiceCommands = {
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/duplicate`),
  convert: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/convert`),
  get: (id: string) => apiClient.get<InvoiceDocument>(resource(id)),
};
