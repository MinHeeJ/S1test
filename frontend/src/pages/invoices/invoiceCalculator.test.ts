import { afterEach, expect, it, vi } from "vitest";
import { testInvoice } from "./invoiceFixture.test";
import { calculateInvoice, koreanAmount } from "./invoiceCalculator";
import { invoiceInteger, invoiceMissingFields } from "./invoiceValidation";
import { InvoiceSaveCoordinator } from "./InvoiceSaveCoordinator";
import { invoiceSnapshot } from "./contracts";

afterEach(() => vi.useRealTimers());
it("all VAT modes use exact integer arithmetic including the maximum supported fifty rows", () => {
  const c = testInvoice().content;
  expect(calculateInvoice(c.items, "separate")).toEqual({
    supply_amount: 3000000,
    vat_amount: 300000,
    total_amount: 3300000,
  });
  const items = [{ ...c.items[0], qty: 1, unitPrice: 550000 }];
  expect(calculateInvoice(items, "included")).toEqual({
    supply_amount: 500000,
    vat_amount: 50000,
    total_amount: 550000,
  });
  expect(calculateInvoice(items, "exempt")).toEqual({
    supply_amount: 550000,
    vat_amount: 0,
    total_amount: 550000,
  });
  expect(
    calculateInvoice([{ ...items[0], unitPrice: 19 }], "separate").vat_amount,
  ).toBe(1);
  const max = Array.from({ length: 50 }, () => ({
    ...items[0],
    qty: 99999,
    unitPrice: 999999999,
  }));
  expect(calculateInvoice(max, "separate").total_amount).toBe(5499944994500055);
});
it.each([
  [3300000, "일금 삼백삼십만원정"],
  [15000, "일금 일만오천원정"],
  [100010000, "일금 일억일만원정"],
  [0, "일금 영원정"],
  [1111, "일금 일천일백일십일원정"],
])(
  "Korean amount %s retains explicit ones and omits zero groups",
  (value, expected) => {
    expect(koreanAmount(value as number)).toBe(expected);
  },
);
it("PDF requirements are not saving requirements; warning-only fields stay optional", () => {
  const c = testInvoice().content;
  c.supplier.bizNo = "warning";
  c.items[0].unitPrice = 0;
  expect(invoiceMissingFields(c)).toEqual([]);
  c.client.name = "";
  c.items[1].qty = 0;
  expect(invoiceMissingFields(c).map((f) => f.label)).toEqual([
    "수신자 · 상호",
    "품목 2번째 · 수량",
  ]);
  expect(invoiceInteger("", 99999)).toBe(0);
  for (const value of ["-1", "0.1", "100000", "1e3"])
    expect(invoiceInteger(value, 99999)).toBeNull();
});
it("debounce serializes edits while a PUT is in flight and flush waits for the latest snapshot", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const put = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const initial = invoiceSnapshot(testInvoice());
  const queue = new InvoiceSaveCoordinator(initial, put, vi.fn());
  queue.change({ ...initial, title: "첫 변경" });
  await vi.advanceTimersByTimeAsync(1499);
  expect(put).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  queue.change({ ...initial, title: "둘째" });
  queue.change({ ...initial, title: "최신" });
  const flushing = queue.flush();
  await vi.advanceTimersByTimeAsync(1500);
  expect(put).toHaveBeenCalledTimes(1);
  release();
  await flushing;
  expect(put).toHaveBeenCalledTimes(2);
  expect(put.mock.calls[1][0].title).toBe("최신");
  expect(queue.state).toBe("저장됨");
  queue.dispose();
});
it("retry sends latest data and does not turn a failed flush into successful navigation", async () => {
  const initial = invoiceSnapshot(testInvoice());
  const put = vi
    .fn()
    .mockRejectedValueOnce(new Error("실패"))
    .mockResolvedValue(undefined);
  const queue = new InvoiceSaveCoordinator(initial, put, vi.fn());
  queue.change(initial);
  await expect(queue.flush()).rejects.toThrow("실패");
  expect(queue.state).toContain("실패");
  queue.change({ ...initial, title: "재시도 최신" });
  await queue.flush();
  expect(put.mock.calls[1][0].title).toBe("재시도 최신");
  queue.dispose();
});
it("dispose cancels the pending debounce", async () => {
  vi.useFakeTimers();
  const put = vi.fn();
  const initial = invoiceSnapshot(testInvoice());
  const queue = new InvoiceSaveCoordinator(initial, put, vi.fn());
  queue.change(initial);
  queue.dispose();
  await vi.advanceTimersByTimeAsync(1600);
  expect(put).not.toHaveBeenCalled();
});
