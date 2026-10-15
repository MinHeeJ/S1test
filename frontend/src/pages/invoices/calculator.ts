import type { InvoiceItem, InvoiceVatMode } from "./contracts";

export function calculate(items: InvoiceItem[], mode: InvoiceVatMode) {
  const sum = items.reduce(
    (total, item) => total + item.qty * item.unitPrice,
    0,
  );
  if (!Number.isSafeInteger(sum) || sum < 0)
    throw new Error("금액 범위를 확인해 주세요.");
  const vat =
    mode === "separate"
      ? Math.floor(sum / 10)
      : mode === "included"
        ? Math.floor(sum / 11)
        : 0;
  return {
    supply: mode === "included" ? sum - vat : sum,
    vat,
    total: mode === "separate" ? sum + vat : sum,
  };
}
export function koreanAmount(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("금액 범위를 확인해 주세요.");
  if (amount === 0) return "일금 영원정";
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  const groups = ["", "만", "억", "조"];
  let result = "";
  for (let g = 0; amount > 0; g++, amount = Math.floor(amount / 10000)) {
    let part = amount % 10000;
    if (!part) continue;
    let text = "";
    for (let n = 0; n < 4; n++, part = Math.floor(part / 10)) {
      const digit = part % 10;
      if (digit) text = digits[digit] + units[n] + text;
    }
    result = text + groups[g] + result;
  }
  return `일금 ${result}원정`;
}
