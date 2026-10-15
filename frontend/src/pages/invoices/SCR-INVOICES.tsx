import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmModal } from "../../shared/ConfirmModal";
import { useToastStore } from "../../shared/Toast";
import { ApiRequestError } from "../../shared/apiClient";
import type { Invoice, InvoiceDocType, InvoicePage } from "./contracts";
import { invoicesApi } from "./invoicesApi";
import "./invoices.css";

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<InvoiceDocType | undefined>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InvoicePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const show = useToastStore((s) => s.show);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void invoicesApi
      .list(type, page)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((failure) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : "조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, page, attempt]);

  async function command(
    action: () => Promise<unknown>,
    target?: Invoice,
    remove = false,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await action();
      if (remove && target) {
        setData(
          (old) =>
            old && {
              ...old,
              items: old.items.filter((row) => row.id !== target.id),
            },
        );
      }
      setDeleting(null);
      setMenu(null);
      show("완료되었습니다.");
      setAttempt((n) => n + 1);
    } catch (failure) {
      if (
        failure instanceof ApiRequestError &&
        failure.status === 404 &&
        target
      ) {
        setDeleting(null);
        setMenu(null);
        setData(
          (old) =>
            old && {
              ...old,
              items: old.items.filter((row) => row.id !== target.id),
            },
        );
      }
      show(failure instanceof Error ? failure.message : "요청 실패");
      throw failure;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function create(docType: InvoiceDocType) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await invoicesApi.create(docType);
      navigate(`/invoices/${encodeURIComponent(result.id)}/edit`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "생성 실패");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="invoices-library" data-testid="invoice-list">
      <header className="invoice-library-heading">
        <h1>견적서 목록</h1>
        <p>최근 수정순 · 20건씩</p>
      </header>
      <div className="invoice-actions">
        {([undefined, "quote", "invoice"] as const).map((value, i) => (
          <button
            key={value ?? "all"}
            data-testid={`A-INV-TAB-${value?.toUpperCase() ?? "ALL"}`}
            aria-pressed={type === value}
            onClick={() => {
              setType(value);
              setPage(1);
              setMenu(null);
            }}
          >
            {["전체", "견적서", "청구서"][i]}
          </button>
        ))}
        <button
          className="primary"
          data-testid="A-INV-CREATE-QUOTE"
          disabled={busy}
          onClick={() => void create("quote")}
        >
          + 새 견적서
        </button>
        <button
          data-testid="A-INV-CREATE-INVOICE"
          disabled={busy}
          onClick={() => void create("invoice")}
        >
          + 새 청구서
        </button>
      </div>
      {error && (
        <div role="alert" className="invoice-error">
          {error}
          <button
            data-testid="invoice-list-retry"
            onClick={() => setAttempt((n) => n + 1)}
          >
            다시 조회
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">목록 불러오는 중…</p>
      ) : (
        data && (
          <>
            {!data.items.length && <p>해당 종류 문서가 없습니다.</p>}
            <div className="invoice-table-scroll">
              <table className="invoice-list-table">
                <thead>
                  <tr>
                    {[
                      "문서번호",
                      "종류",
                      "제목",
                      "수신자",
                      "발행일",
                      "합계",
                      "입금",
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr
                      key={row.id}
                      data-testid={`A-INV-ROW-${row.id}`}
                      onClick={() =>
                        navigate(`/invoices/${encodeURIComponent(row.id)}/edit`)
                      }
                    >
                      <td>{row.doc_no}</td>
                      <td>{row.doc_type === "quote" ? "견적서" : "청구서"}</td>
                      <td>
                        <Link
                          data-testid={`invoice-edit-${row.id}`}
                          to={`/invoices/${encodeURIComponent(row.id)}/edit`}
                        >
                          {row.title}
                        </Link>
                        <button
                          data-testid={`A-INV-MENU-${row.id}`}
                          aria-label={`${row.doc_no} 메뉴`}
                          aria-expanded={menu === row.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === row.id ? null : row.id);
                          }}
                        >
                          ⋯
                        </button>
                        {menu === row.id && (
                          <div
                            className="invoice-row-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              data-testid={`A-INV-DUPLICATE-${row.id}`}
                              disabled={busy}
                              onClick={() =>
                                void command(
                                  () => invoicesApi.duplicate(row.id),
                                  row,
                                ).catch(() => undefined)
                              }
                            >
                              복제
                            </button>
                            <button
                              data-testid={`A-INV-DELETE-OPEN-${row.id}`}
                              disabled={busy}
                              onClick={() => {
                                setDeleting(row);
                                setMenu(null);
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{row.content.client.name}</td>
                      <td>{row.content.issueDate}</td>
                      <td>{row.total_amount.toLocaleString("ko-KR")}원</td>
                      <td>
                        {row.doc_type === "invoice" && row.paid && (
                          <span className="invoice-paid">입금 완료</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="invoice-actions" aria-label="문서 페이지">
              <button
                data-testid="A-INV-PAGE-PREV"
                disabled={loading || data.page <= 1}
                onClick={() => setPage(data.page - 1)}
              >
                이전 페이지
              </button>
              <span>
                {data.page} 페이지 · {data.total}건
              </span>
              <button
                data-testid="A-INV-PAGE-NEXT"
                disabled={loading || data.page * data.size >= data.total}
                onClick={() => setPage(data.page + 1)}
              >
                다음 페이지
              </button>
            </nav>
          </>
        )
      )}
      {deleting && (
        <div data-testid="invoice-delete-modal">
          <ConfirmModal
            title="삭제 확인"
            message={`${deleting.doc_no} · ${deleting.title} 문서를 삭제하시겠습니까?`}
            onCancel={() => setDeleting(null)}
            onConfirm={() =>
              command(() => invoicesApi.delete(deleting.id), deleting, true)
            }
          />
        </div>
      )}
    </section>
  );
}
