import { apiClient } from "../../shared/apiClient";
import type { InvoicePrintDocument } from "./contracts";

const resource = (id: string) => `/api/invoices/${encodeURIComponent(id)}`;

export const invoiceCopyApi = {
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/duplicate`),
  convert: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/convert`),
  get: (id: string) => apiClient.get<InvoicePrintDocument>(resource(id)),
};
