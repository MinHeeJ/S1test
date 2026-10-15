import { expect, it } from "vitest";
import type { Invoice } from "./contracts";

export function testInvoice(): Invoice {
  return {
    id: "27",
    user_id: "1",
    doc_type: "quote",
    doc_no: "Q-2026-0001",
    source_quote_id: null,
    title: "지원 견적",
    paid: false,
    deleted: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    supply_amount: 3000000,
    vat_amount: 300000,
    total_amount: 3300000,
    content: {
      supplier: { name: "공급자", bizNo: "", ceo: "", address: "", phone: "" },
      client: { name: "수신자", contact: "" },
      issueDate: "2026-01-01",
      validUntil: "",
      items: [
        {
          id: "item-one",
          name: "기획",
          spec: "",
          qty: 1,
          unitPrice: 1000000,
          note: "",
        },
        {
          id: "item-two",
          name: "디자인",
          spec: "",
          qty: 1,
          unitPrice: 1500000,
          note: "",
        },
        {
          id: "item-three",
          name: "퍼블리싱",
          spec: "",
          qty: 10,
          unitPrice: 50000,
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
it("fixture represents the complete public invoice metadata", () =>
  expect(testInvoice().user_id).toBe("1"));
