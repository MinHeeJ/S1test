import { expect, it } from "vitest";
import { missingFields } from "./pdfValidation";
import { testInvoice } from "./testInvoice";
it("only PDF requires supplier/client/date/item name/positive quantity, not bizNo, account, or unit price", () => {
  const c = testInvoice().content;
  c.items[0].unitPrice = 0;
  expect(missingFields(c)).toEqual([]);
  c.client.name = " ";
  c.items[0].qty = 0;
  expect(missingFields(c)).toEqual([
    { label: "수신자 · 상호", id: "client-name" },
    { label: "품목 1 · 수량", id: "item-line-one-qty" },
  ]);
  c.items = [];
  expect(missingFields(c).map((f) => f.id)).toContain("add-item");
});
