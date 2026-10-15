import type { CSSProperties } from "react";
import type { Invoice } from "./contracts";
import { koreanAmount } from "./invoiceCalculator";
import { photoUrl } from "../photos/photoApi";
import "./invoices.css";

/** A continuous A4 flow uses the browser's page fragmentation, never clipping long notes or item rows. */
export function InvoiceRenderer({ invoice }: { invoice: Invoice }) {
  const c = invoice.content;
  const money = (value: number) => value.toLocaleString("ko-KR");
  return (
    <article
      className="invoice-paper"
      data-testid="invoice-paper"
      style={{ "--invoice-color": c.color } as CSSProperties}
    >
      <h1>{invoice.doc_type === "quote" ? "견 적 서" : "청 구 서"}</h1>
      <p>
        문서번호: {invoice.doc_no} · 발행일: {c.issueDate}
      </p>
      <p>
        {c.client.name} 귀하 {c.client.contact}
      </p>
      <section className="invoice-supplier">
        <h2>공급자</h2>
        <p>
          {c.supplier.name}
          {c.stampPhotoId && (
            <img
              className="invoice-stamp"
              src={photoUrl(c.stampPhotoId)}
              alt="직인"
            />
          )}
        </p>
        <p>
          사업자등록번호: {c.supplier.bizNo} · 대표자: {c.supplier.ceo}
        </p>
        <p>
          주소: {c.supplier.address} · 연락처: {c.supplier.phone}
        </p>
      </section>
      <p>
        {invoice.doc_type === "quote"
          ? `유효기한: ${c.validUntil ?? ""}`
          : `지급기한: ${c.dueDate ?? ""}`}
      </p>
      <p className="invoice-korean">{koreanAmount(invoice.total_amount)}</p>
      <table>
        <thead>
          <tr>
            {["품명", "규격", "수량", "단가", "금액", "비고"].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.items.map((item) => (
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
        <p>{c.notes}</p>
      </section>
      {invoice.doc_type === "invoice" && <p>입금 계좌: {c.bankAccount}</p>}
    </article>
  );
}
