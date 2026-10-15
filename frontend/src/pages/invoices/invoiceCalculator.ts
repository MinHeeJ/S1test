import type { InvoiceItem, InvoiceVatMode } from "./contracts";

export function calculateInvoice(items: InvoiceItem[], mode: InvoiceVatMode) {
  const sum = items.reduce(
    (total, item) => total + item.qty * item.unitPrice,
    0,
  );
  const vat =
    mode === "exempt" ? 0 : Math.floor(sum / (mode === "included" ? 11 : 10));
  return {
    supply_amount: mode === "included" ? sum - vat : sum,
    vat_amount: vat,
    total_amount: mode === "separate" ? sum + vat : sum,
  };
}

export function koreanAmount(value: number): string {
  if (value === 0) return "일금 영원정";
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  const groups = ["", "만", "억", "조"];
  let remaining = value;
  let index = 0;
  const words: string[] = [];
  while (remaining > 0) {
    let group = remaining % 10000;
    let word = "";
    for (let place = 0; place < 4; place++) {
      const digit = group % 10;
      if (digit) word = digits[digit] + units[place] + word;
      group = Math.floor(group / 10);
    }
    if (word) words.unshift(word + groups[index]);
    remaining = Math.floor(remaining / 10000);
    index++;
  }
  return `일금 ${words.join("")}원정`;
}
