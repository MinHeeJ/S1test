import { expect, it } from "vitest";
import { calculate, koreanAmount } from "./calculator";
import { testInvoice } from "./testInvoice";
it("calculates all VAT modes using integer floors and original three seed items", () => {
  const i = testInvoice().content.items[0];
  const items = [
    { ...i, qty: 1, unitPrice: 1000000 },
    { ...i, qty: 1, unitPrice: 1500000 },
    { ...i, qty: 10, unitPrice: 50000 },
  ];
  expect(calculate(items, "separate")).toEqual({
    supply: 3000000,
    vat: 300000,
    total: 3300000,
  });
  expect(calculate([{ ...i, unitPrice: 550000 }], "included")).toEqual({
    supply: 500000,
    vat: 50000,
    total: 550000,
  });
  expect(calculate([{ ...i, unitPrice: 19 }], "separate")).toEqual({
    supply: 19,
    vat: 1,
    total: 20,
  });
  expect(calculate(items, "exempt")).toEqual({
    supply: 3000000,
    vat: 0,
    total: 3000000,
  });
  expect(
    calculate(
      Array.from({ length: 50 }, () => ({
        ...i,
        qty: 99999,
        unitPrice: 999999999,
      })),
      "separate",
    ),
  ).toEqual({
    supply: 4999949995000050,
    vat: 499994999500005,
    total: 5499944994500055,
  });
});
it.each([
  [0, "일금 영원정"],
  [3300000, "일금 삼백삼십만원정"],
  [15000, "일금 일만오천원정"],
  [100010000, "일금 일억일만원정"],
  [1111, "일금 일천일백일십일원정"],
])("renders %s as %s", (amount, expected) =>
  expect(koreanAmount(amount as number)).toBe(expected),
);
