import type { Invoice } from "./contracts";
export function testInvoice(): Invoice {
  return {
    id: "27",
    user_id: "1",
    doc_type: "quote",
    doc_no: "Q-2026-0001",
    source_quote_id: null,
    title: "홈페이지 견적",
    supply_amount: 3000000,
    vat_amount: 300000,
    total_amount: 3300000,
    paid: false,
    deleted: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    content: {
      supplier: { name: "지우", bizNo: "", ceo: "", address: "", phone: "" },
      client: { name: "수신자", contact: "" },
      issueDate: "2026-01-01",
      validUntil: "",
      items: [
        {
          id: "line-one",
          name: "기획",
          spec: "",
          qty: 1,
          unitPrice: 3000000,
          note: "",
        },
      ],
      vatMode: "separate",
      notes: "",
      stampPhotoId: null,
      color: "#1F3A5F",
    },
  };
}
