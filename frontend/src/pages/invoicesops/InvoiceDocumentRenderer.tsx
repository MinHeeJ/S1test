import type { InvoiceDocument } from "./InvoiceDocument";
import "./invoicePrint.css";

/** Integer-only grouping; unlike positional English numerals, each nonzero 4-digit group retains 일. */
export function invoiceKoreanAmount(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("금액을 확인해 주세요.");
  if (amount === 0) return "일금 영원정";
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  const groups = ["", "만", "억", "조"];
  let value = amount;
  let result = "";
  let group = 0;
  while (value > 0) {
    let part = value % 10000;
    let text = "";
    for (let place = 0; place < 4; place++) {
      const digit = part % 10;
      if (digit) text = digits[digit] + units[place] + text;
      part = Math.floor(part / 10);
    }
    if (text) result = text + groups[group] + result;
    group++;
    value = Math.floor(value / 10000);
  }
  return `일금 ${result}원정`;
}

/** One flowing A4 document for preview and print: no fixed-height clipping of long notes or 50 item rows. */
export function InvoiceDocumentRenderer({
  invoice,
}: {
  invoice: InvoiceDocument;
}) {
  const content = invoice.content;
  const money = (amount: number) => amount.toLocaleString("ko-KR");
  return (
    <article
      className="invoice-document"
      style={{ color: "#111" }}
      data-testid="invoice-document"
    >
      <h1 style={{ color: content.color }}>
        {invoice.doc_type === "quote" ? "견 적 서" : "청 구 서"}
      </h1>
      <p>
        문서번호: {invoice.doc_no} · 발행일: {content.issueDate}
      </p>
      <h2>{content.client.name} 귀하</h2>
      <p>{content.client.contact}</p>
      <section className="invoice-supplier">
        <h2>
          {content.supplier.name}
          {content.stampPhotoId && (
            <img
              className="invoice-stamp"
              src={`/api/photos/${encodeURIComponent(content.stampPhotoId)}`}
              alt="공급자 직인"
            />
          )}
        </h2>
        <dl>
          <dt>사업자등록번호</dt>
          <dd>{content.supplier.bizNo}</dd>
          <dt>대표자</dt>
          <dd>{content.supplier.ceo}</dd>
          <dt>주소</dt>
          <dd>{content.supplier.address}</dd>
          <dt>연락처</dt>
          <dd>{content.supplier.phone}</dd>
        </dl>
      </section>
      <p>{invoiceKoreanAmount(invoice.total_amount)}</p>
      <table>
        <thead style={{ color: content.color }}>
          <tr>
            <th>품명</th>
            <th>규격</th>
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {content.items.map((item) => (
            <tr key={item.id} data-testid={`invoice-print-item-${item.id}`}>
              <td>{item.name}</td>
              <td>{item.spec}</td>
              <td>{money(item.qty)}</td>
              <td>{money(item.unitPrice)}</td>
              <td>{money(item.qty * item.unitPrice)}</td>
              <td>{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="invoice-totals">
        <dt>공급가액</dt>
        <dd>{money(invoice.supply_amount)}원</dd>
        <dt>부가세</dt>
        <dd>{money(invoice.vat_amount)}원</dd>
        <dt>합계</dt>
        <dd>{money(invoice.total_amount)}원</dd>
      </dl>
      <section className="invoice-notes">
        <h2>비고</h2>
        <p>{content.notes}</p>
      </section>
      {invoice.doc_type === "quote" ? (
        <p>유효기한: {content.validUntil}</p>
      ) : (
        <>
          <p>지급기한: {content.dueDate}</p>
          <p>입금 계좌: {content.bankAccount}</p>
        </>
      )}
    </article>
  );
}
