import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmModal } from "../../shared/ConfirmModal";
import { useToastStore } from "../../shared/Toast";
import { invoicesApi } from "./invoicesApi";
import type { Invoice, InvoiceDocType, InvoicePage } from "./contracts";
import "./invoices.css";

export default function InvoicesPage() {
  const [type, setType] = useState<InvoiceDocType | undefined>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InvoicePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    void invoicesApi
      .list(type, page)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [type, page, attempt]);
  async function create(docType: InvoiceDocType) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await invoicesApi.create(docType);
      navigate(`/invoices/${result.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function duplicate(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await invoicesApi.duplicate(id);
      navigate(`/invoices/${result.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "복제 실패");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="invoice-library" data-testid="invoices-page">
      <div className="invoice-toolbar">
        <h1>견적서·청구서</h1>
        <button
          disabled={busy}
          onClick={() => void create("quote")}
          data-testid="create-quote"
        >
          새 견적서
        </button>
        <button
          disabled={busy}
          onClick={() => void create("invoice")}
          data-testid="create-invoice"
        >
          새 청구서
        </button>
      </div>
      <nav aria-label="문서 종류">
        {([undefined, "quote", "invoice"] as const).map((value, index) => (
          <button
            key={value ?? "all"}
            aria-pressed={type === value}
            data-testid={`invoice-filter-${value ?? "all"}`}
            onClick={() => {
              setType(value);
              setPage(1);
            }}
          >
            {["전체", "견적서", "청구서"][index]}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert">
          {error}
          <button
            data-testid="invoice-list-retry"
            onClick={() => setAttempt(attempt + 1)}
          >
            다시 시도
          </button>
        </div>
      )}
      {!data && !error && <p role="status">문서 불러오는 중…</p>}
      {data && !data.items.length && (
        <p>문서가 없습니다. 새 견적서 또는 청구서를 만들어 보세요.</p>
      )}
      {data && data.items.length > 0 && (
        <div className="invoice-table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "종류",
                  "문서번호",
                  "제목",
                  "수신자",
                  "합계",
                  "수정일",
                  "작업",
                ].map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} data-testid={`invoice-row-${row.id}`}>
                  <td>{row.doc_type === "quote" ? "견적서" : "청구서"}</td>
                  <td>{row.doc_no}</td>
                  <td>
                    <Link
                      to={`/invoices/${row.id}/edit`}
                      data-testid={`invoice-edit-${row.id}`}
                    >
                      {row.title}
                    </Link>
                    {row.doc_type === "invoice" && row.paid && (
                      <span className="invoice-badge">입금 완료</span>
                    )}
                  </td>
                  <td>{row.content.client.name}</td>
                  <td>{row.total_amount.toLocaleString("ko-KR")}원</td>
                  <td>
                    <time dateTime={row.updated_at}>
                      {new Date(row.updated_at).toLocaleDateString("ko-KR")}
                    </time>
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      data-testid={`invoice-duplicate-${row.id}`}
                      onClick={() => void duplicate(row.id)}
                    >
                      복제
                    </button>
                    <button
                      data-testid={`invoice-delete-${row.id}`}
                      onClick={() => setSelected(row)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <nav aria-label="페이지">
          <button
            disabled={page === 1}
            data-testid="invoice-previous"
            onClick={() => setPage(page - 1)}
          >
            이전
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil(data.total / 20))}
          </span>
          <button
            disabled={page * 20 >= data.total}
            data-testid="invoice-next"
            onClick={() => setPage(page + 1)}
          >
            다음
          </button>
        </nav>
      )}
      {selected && (
        <ConfirmModal
          title="문서 삭제"
          message={`“${selected.title}” 문서를 삭제하시겠습니까?`}
          onCancel={() => setSelected(null)}
          onConfirm={async () => {
            await invoicesApi.delete(selected.id);
            setSelected(null);
            useToastStore.getState().show("문서를 삭제했습니다.");
            if (data?.items.length === 1 && page > 1) setPage(page - 1);
            else setAttempt(attempt + 1);
          }}
        />
      )}
    </section>
  );
}
