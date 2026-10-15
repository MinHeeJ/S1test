import { apiClient } from "../../shared/apiClient";
import type {
  Invoice,
  InvoiceDocType,
  InvoicePage,
  InvoiceWrite,
} from "./contracts";

const path = (id: string) => `/api/invoices/${encodeURIComponent(id)}`;
export const invoicesApi = {
  list: (type?: InvoiceDocType, page = 1) => {
    const query = new URLSearchParams({ page: String(page), size: "20" });
    if (type) query.set("type", type);
    return apiClient.get<InvoicePage>(`/api/invoices?${query}`);
  },
  get: (id: string) => apiClient.get<Invoice>(path(id)),
  create: (docType: InvoiceDocType) =>
    apiClient.post<{ id: string }>("/api/invoices", { docType }),
  save: (id: string, value: InvoiceWrite) => apiClient.put(path(id), value),
  delete: (id: string) => apiClient.delete(path(id)),
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(`${path(id)}/duplicate`),
  convert: (id: string) =>
    apiClient.post<{ id: string }>(`${path(id)}/convert`),
};
