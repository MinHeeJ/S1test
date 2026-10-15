import type { Invoice } from "./contracts";
import { calculate, koreanAmount } from "./calculator";
import "./invoices.css";

/** Natural-height A4 document: print pagination never clips long notes or the fiftieth item. */
export function InvoiceRenderer({
  invoice,
  saved = false,
}: {
  invoice: Invoice;
  saved?: boolean;
}) {
  const c = invoice.content;
  const computed = calculate(c.items, c.vatMode);
  const amounts = saved
    ? {
        supply: invoice.supply_amount,
        vat: invoice.vat_amount,
        total: invoice.total_amount,
      }
    : computed;
  return (
    <article
      className="invoice-paper"
      style={{ borderTopColor: c.color }}
      data-testid="invoice-renderer"
    >
      <h1 style={{ color: c.color }}>
        {invoice.doc_type === "quote" ? "견적서" : "청구서"}
      </h1>
      <p>{invoice.doc_no}</p>
      <p>발행일: {c.issueDate}</p>
      <p>
        {invoice.doc_type === "quote"
          ? `유효기한: ${c.validUntil ?? ""}`
          : `지급기한: ${c.dueDate ?? ""}`}
      </p>
      <div className="invoice-parties">
        <section>
          <h2>수신자</h2>
          <p>{c.client.name}</p>
          <p>{c.client.contact}</p>
        </section>
        <section>
          <h2>공급자</h2>
          <p>
            {c.supplier.name} {c.supplier.ceo}
          </p>
          <p>{c.supplier.bizNo}</p>
          <p>{c.supplier.address}</p>
          <p>{c.supplier.phone}</p>
          {c.stampPhotoId && (
            <img
              src={`/api/photos/${encodeURIComponent(c.stampPhotoId)}`}
              alt="공급자 직인"
              className="invoice-stamp"
            />
          )}
        </section>
      </div>
      <p className="invoice-total">
        합계 {amounts.total.toLocaleString("ko-KR")}원
      </p>
      <p>{koreanAmount(amounts.total)}</p>
      <table>
        <thead>
          <tr>
            {["번호", "품명", "규격", "수량", "단가", "금액", "비고"].map(
              (label) => (
                <th key={label}>{label}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {c.items.map((item, index) => (
            <tr key={item.id} data-testid={`invoice-paper-item-${item.id}`}>
              <td>{index + 1}</td>
              <td>{item.name}</td>
              <td>{item.spec}</td>
              <td>{item.qty.toLocaleString("ko-KR")}</td>
              <td>{item.unitPrice.toLocaleString("ko-KR")}</td>
              <td>{(item.qty * item.unitPrice).toLocaleString("ko-KR")}</td>
              <td>{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="invoice-amounts">
        <dt>공급가액</dt>
        <dd>{amounts.supply.toLocaleString("ko-KR")}원</dd>
        <dt>부가세</dt>
        <dd>{amounts.vat.toLocaleString("ko-KR")}원</dd>
        <dt>합계</dt>
        <dd>{amounts.total.toLocaleString("ko-KR")}원</dd>
      </dl>
      <p className="invoice-notes">{c.notes}</p>
      {invoice.doc_type === "invoice" && <p>입금 계좌: {c.bankAccount}</p>}
    </article>
  );
}
