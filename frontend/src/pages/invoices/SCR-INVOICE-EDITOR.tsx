import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { registerNavigationFlush } from "../../app/navigationGuard";
import { ApiRequestError } from "../../shared/apiClient";
import { invoicesApi } from "./invoicesApi";
import { invoiceColors, invoiceSnapshot } from "./contracts";
import type {
  Invoice,
  InvoiceContent,
  InvoiceItem,
  InvoiceWrite,
} from "./contracts";
import { SaveCoordinator, type SaveState } from "./SaveCoordinator";
import { InvoiceRenderer } from "./InvoiceRenderer";
import { missingFields, type InvoiceMissingField } from "./pdfValidation";
import "./invoices.css";

export default function InvoiceEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const latest = useRef<Invoice | null>(null);
  const queue = useRef<SaveCoordinator>();
  const [state, setState] = useState<SaveState>("저장됨");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState("input");
  const [missing, setMissing] = useState<InvoiceMissingField[] | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const focusAfterModal = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let unregister: (() => void) | undefined;
    setInvoice(null);
    latest.current = null;
    setError(null);
    if (!id) return;
    void invoicesApi
      .get(id)
      .then((result) => {
        if (!active) return;
        setInvoice(result);
        latest.current = result;
        const coordinator = new SaveCoordinator(
          invoiceSnapshot(result),
          async (value) => {
            try {
              await invoicesApi.save(id, value);
              setError(null);
            } catch (e) {
              if (active)
                setError(
                  e instanceof ApiRequestError && e.error.field
                    ? `${e.error.field}: ${e.message}`
                    : e instanceof Error
                      ? e.message
                      : "저장 실패",
                );
              throw e;
            }
          },
          setState,
        );
        queue.current = coordinator;
        unregister = registerNavigationFlush(() => coordinator.flush());
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      unregister?.();
      queue.current?.dispose();
      queue.current = undefined;
      frame.current?.remove();
      frame.current = null;
    };
  }, [id, attempt]);
  useEffect(() => {
    if (state === "저장됨") return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [state]);
  useEffect(() => {
    if (!missing && tab === "input" && focusAfterModal.current) {
      document.getElementById(focusAfterModal.current)?.focus();
      focusAfterModal.current = null;
    }
  }, [missing, tab]);
  useEffect(() => {
    const message = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        !frame.current ||
        event.source !== frame.current.contentWindow
      )
        return;
      if (
        !["invoice-print-finished", "invoice-print-error"].includes(
          event.data?.type,
        )
      )
        return;
      if (event.data.type === "invoice-print-error")
        setError("인쇄 준비에 실패했습니다. 다시 시도해 주세요.");
      frame.current.remove();
      frame.current = null;
      pending.current = false;
      setBusy(false);
    };
    window.addEventListener("message", message);
    return () => window.removeEventListener("message", message);
  }, []);

  function change(patch: Partial<InvoiceWrite>) {
    if (!latest.current) return;
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setInvoice(next);
    queue.current?.change(invoiceSnapshot(next));
  }
  function content(patch: Partial<InvoiceContent>) {
    if (latest.current)
      change({ content: { ...latest.current.content, ...patch } });
  }
  function itemChange(itemId: string, patch: Partial<InvoiceItem>) {
    if (latest.current)
      content({
        items: latest.current.content.items.map((i) =>
          i.id === itemId ? { ...i, ...patch } : i,
        ),
      });
  }
  async function action(command: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await queue.current?.flush();
      await command();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      if (!frame.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  async function pdf() {
    if (!latest.current || pending.current) return;
    const fields = missingFields(latest.current.content);
    if (fields.length) {
      setMissing(fields);
      return;
    }
    await action(async () => {
      const currentMissing = missingFields(latest.current!.content);
      if (currentMissing.length) {
        setMissing(currentMissing);
        return;
      }
      const iframe = document.createElement("iframe");
      iframe.title = "견적서·청구서 PDF";
      iframe.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
      iframe.src = `/print/invoice/${encodeURIComponent(id!)}`;
      frame.current = iframe;
      document.body.appendChild(iframe);
    });
  }
  function moveItem(from: number, to: number) {
    if (!latest.current || to < 0 || to >= latest.current.content.items.length)
      return;
    const items = [...latest.current.content.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    content({ items });
  }
  function field(
    label: string,
    fieldId: string,
    value: string,
    update: (value: string) => void,
    type = "text",
  ) {
    return (
      <label key={fieldId} htmlFor={fieldId}>
        {label}
        <input
          id={fieldId}
          data-testid={fieldId}
          type={type}
          value={value}
          onChange={(event) => update(event.target.value)}
        />
      </label>
    );
  }
  if (!invoice)
    return (
      <section data-testid="invoice-editor-page">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">편집 자료 불러오는 중…</p>
        )}
        {error && (
          <button
            data-testid="invoice-editor-retry"
            onClick={() => setAttempt(attempt + 1)}
          >
            다시 시도
          </button>
        )}
      </section>
    );
  const c = invoice.content;
  return (
    <section className="invoice-editor" data-testid="invoice-editor-page">
      <div className="invoice-toolbar">
        <button
          data-testid="invoice-back"
          disabled={busy}
          onClick={() => void action(async () => navigate("/invoices"))}
        >
          목록
        </button>
        <strong>
          {invoice.doc_no} ·{" "}
          {invoice.doc_type === "quote" ? "견적서" : "청구서"}
        </strong>
        <span role="status" data-testid="invoice-save-state">
          {state}
        </span>
        <button
          data-testid="invoice-save"
          disabled={busy}
          onClick={() => void action(async () => undefined)}
        >
          {state === "저장 실패·다시 시도" ? "저장 다시 시도" : "저장"}
        </button>
        {invoice.doc_type === "quote" && (
          <button
            data-testid="invoice-convert"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const result = await invoicesApi.convert(invoice.id);
                navigate(`/invoices/${result.id}/edit`);
              })
            }
          >
            청구서로 변환
          </button>
        )}
        {invoice.doc_type === "invoice" && (
          <label>
            <input
              type="checkbox"
              checked={invoice.paid}
              data-testid="invoice-paid"
              onChange={(event) => change({ paid: event.target.checked })}
            />
            입금 완료
          </label>
        )}
        <button
          data-testid="invoice-pdf"
          disabled={busy}
          onClick={() => void pdf()}
        >
          PDF 내보내기
        </button>
      </div>
      {error && (
        <p role="alert" data-testid="invoice-editor-error">
          {error}
        </p>
      )}
      <div className="invoice-mobile-tabs">
        <button
          data-testid="invoice-input-tab"
          aria-pressed={tab === "input"}
          onClick={() => setTab("input")}
        >
          입력
        </button>
        <button
          data-testid="invoice-preview-tab"
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </div>
      <div className={`invoice-workspace invoice-tab-${tab}`}>
        <div className="invoice-form" data-testid="invoice-input-panel">
          {field("제목", "invoice-title", invoice.title, (title) =>
            change({ title }),
          )}
          <fieldset>
            <legend>공급자</legend>
            {(["name", "bizNo", "ceo", "address", "phone"] as const).map(
              (key) => {
                const label = {
                  name: "상호",
                  bizNo: "사업자등록번호",
                  ceo: "대표자",
                  address: "주소",
                  phone: "연락처",
                }[key];
                return field(
                  `공급자 ${label}`,
                  `supplier-${key}`,
                  c.supplier[key],
                  (value) =>
                    content({
                      supplier: {
                        ...latest.current!.content.supplier,
                        [key]: value,
                      },
                    }),
                );
              },
            )}
            {c.supplier.bizNo &&
              !/^[0-9]{3}-[0-9]{2}-[0-9]{5}$/.test(c.supplier.bizNo) && (
                <p>사업자등록번호 형식을 확인해 주세요. 저장은 가능합니다.</p>
              )}
          </fieldset>
          <fieldset>
            <legend>수신자</legend>
            {field("수신자 상호", "client-name", c.client.name, (name) =>
              content({ client: { ...c.client, name } }),
            )}
            {field(
              "수신자 연락처",
              "client-contact",
              c.client.contact,
              (contact) => content({ client: { ...c.client, contact } }),
            )}
          </fieldset>
          {field(
            "발행일",
            "issue-date",
            c.issueDate,
            (issueDate) => content({ issueDate }),
            "date",
          )}
          {invoice.doc_type === "quote" ? (
            field(
              "유효기한",
              "valid-until",
              c.validUntil ?? "",
              (validUntil) => content({ validUntil }),
              "date",
            )
          ) : (
            <>
              {field(
                "지급기한",
                "due-date",
                c.dueDate ?? "",
                (dueDate) => content({ dueDate }),
                "date",
              )}
              {field(
                "입금 계좌",
                "bank-account",
                c.bankAccount ?? "",
                (bankAccount) => content({ bankAccount }),
              )}
            </>
          )}
          <fieldset>
            <legend>품목 ({c.items.length}/50)</legend>
            {c.items.map((item, index) => (
              <div
                key={item.id}
                className="invoice-item"
                data-testid={`invoice-item-${item.id}`}
                draggable
                onDragStart={() => setDragged(item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = c.items.findIndex((i) => i.id === dragged);
                  if (from >= 0) moveItem(from, index);
                  setDragged(null);
                }}
              >
                <strong>품목 {index + 1}</strong>
                {(["name", "spec", "note"] as const).map((key, n) =>
                  field(
                    ["품명", "규격", "품목 비고"][n],
                    `item-${item.id}-${key}`,
                    item[key],
                    (value) => itemChange(item.id, { [key]: value }),
                  ),
                )}
                {(["qty", "unitPrice"] as const).map((key) => (
                  <label key={key}>
                    {key === "qty" ? "수량" : "단가"}
                    <input
                      id={`item-${item.id}-${key}`}
                      data-testid={`item-${item.id}-${key}`}
                      type="number"
                      min={0}
                      max={key === "qty" ? 99999 : 999999999}
                      step={1}
                      value={item[key]}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 0 : Number(e.target.value);
                        if (
                          Number.isInteger(value) &&
                          value >= 0 &&
                          value <= (key === "qty" ? 99999 : 999999999)
                        ) {
                          itemChange(item.id, { [key]: value });
                        }
                      }}
                    />
                  </label>
                ))}
                <span>
                  금액 {(item.qty * item.unitPrice).toLocaleString("ko-KR")}원
                </span>
                <div>
                  <button
                    data-testid={`item-up-${item.id}`}
                    disabled={index === 0}
                    onClick={() => moveItem(index, index - 1)}
                  >
                    위로
                  </button>
                  <button
                    data-testid={`item-down-${item.id}`}
                    disabled={index === c.items.length - 1}
                    onClick={() => moveItem(index, index + 1)}
                  >
                    아래로
                  </button>
                  <button
                    data-testid={`item-delete-${item.id}`}
                    onClick={() =>
                      content({
                        items: c.items.filter((i) => i.id !== item.id),
                      })
                    }
                  >
                    품목 삭제
                  </button>
                </div>
              </div>
            ))}
            <button
              id="add-item"
              data-testid="add-item"
              disabled={c.items.length >= 50}
              onClick={() =>
                content({
                  items: [
                    ...c.items,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      spec: "",
                      qty: 0,
                      unitPrice: 0,
                      note: "",
                    },
                  ],
                })
              }
            >
              품목 추가
            </button>
          </fieldset>
          <label>
            부가세 방식
            <select
              value={c.vatMode}
              data-testid="invoice-vat-mode"
              onChange={(e) =>
                content({
                  vatMode: e.target.value as InvoiceContent["vatMode"],
                })
              }
            >
              <option value="separate">별도</option>
              <option value="included">포함</option>
              <option value="exempt">면세</option>
            </select>
          </label>
          <label>
            비고
            <textarea
              data-testid="invoice-notes"
              value={c.notes}
              onChange={(e) => content({ notes: e.target.value })}
            />
          </label>
          <label>
            강조색
            <select
              data-testid="invoice-color"
              value={c.color}
              onChange={(e) => content({ color: e.target.value })}
            >
              {invoiceColors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
          <label>
            직인 업로드 (JPG·PNG, 2MB)
            <input
              type="file"
              accept="image/jpeg,image/png"
              data-testid="invoice-stamp-upload"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (
                  !["image/jpeg", "image/png"].includes(file.type) ||
                  file.size > 2000000
                ) {
                  setError(
                    "JPG·PNG, 2000000 bytes 이하 이미지를 선택해 주세요.",
                  );
                  return;
                }
                void action(async () => {
                  const result = await invoicesApi.uploadPhoto(file);
                  content({ stampPhotoId: result.photoId });
                });
              }}
            />
          </label>
          {c.stampPhotoId && (
            <button
              data-testid="invoice-stamp-remove"
              onClick={() => content({ stampPhotoId: null })}
            >
              직인 연결 해제
            </button>
          )}
        </div>
        <div className="invoice-preview" data-testid="invoice-preview-panel">
          <InvoiceRenderer invoice={invoice} />
        </div>
      </div>
      {missing && (
        <div className="modal-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="빠진 항목"
            className="modal"
            data-testid="invoice-missing-modal"
          >
            <h2>빠진 항목</h2>
            <p>PDF 내보내기 전에 다음 항목을 입력해 주세요.</p>
            {missing.map((f) => (
              <button
                key={f.id}
                data-testid={`missing-${f.id}`}
                onClick={() => {
                  focusAfterModal.current = f.id;
                  setTab("input");
                  setMissing(null);
                }}
              >
                {f.label}
              </button>
            ))}
            <button
              data-testid="invoice-missing-close"
              onClick={() => setMissing(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
