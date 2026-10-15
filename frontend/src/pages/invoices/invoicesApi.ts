import { apiClient, apiRequest } from "../../shared/apiClient";
import type {
  Invoice,
  InvoiceDocType,
  InvoicePage,
  InvoiceWrite,
} from "./contracts";

const resource = (id: string) => `/api/invoices/${encodeURIComponent(id)}`;
export const invoicesApi = {
  list: (type?: InvoiceDocType, page = 1) => {
    const query = new URLSearchParams({ page: String(page), size: "20" });
    if (type) query.set("type", type);
    return apiClient.get<InvoicePage>(`/api/invoices?${query}`);
  },
  get: (id: string) => apiClient.get<Invoice>(resource(id)),
  create: (docType: InvoiceDocType) =>
    apiClient.post<{ id: string }>("/api/invoices", { docType }),
  save: (id: string, snapshot: InvoiceWrite) =>
    apiClient.put(resource(id), snapshot),
  delete: (id: string) => apiClient.delete(resource(id)),
  duplicate: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/duplicate`),
  convert: (id: string) =>
    apiClient.post<{ id: string }>(`${resource(id)}/convert`),
  uploadPhoto: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<{ photoId: string }>("/api/photos", {
      method: "POST",
      body,
    });
  },
};
