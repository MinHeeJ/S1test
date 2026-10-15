import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { registerNavigationFlush } from "../../app/navigationGuard";
import { ApiRequestError } from "../../shared/apiClient";
import { useToastStore } from "../../shared/Toast";
import { uploadPhoto } from "../photos/photoApi";
import type {
  Invoice,
  InvoiceContent,
  InvoiceItem,
  InvoiceWrite,
} from "./contracts";
import { invoiceSnapshot } from "./contracts";
import { invoicesApi } from "./invoicesApi";
import { InvoiceRenderer } from "./InvoiceRenderer";
import { calculateInvoice } from "./invoiceCalculator";
import {
  InvoiceSaveCoordinator,
  type SaveState,
} from "./InvoiceSaveCoordinator";
import {
  invoiceInteger,
  invoiceMissingFields,
  type InvoiceMissingField,
} from "./invoiceValidation";
import "./invoices.css";

const colors: InvoiceContent["color"][] = [
  "#1F3A5F",
  "#2563EB",
  "#0F766E",
  "#9F1239",
  "#C2410C",
  "#374151",
];

export default function InvoiceEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const latest = useRef<Invoice | null>(null);
  const queue = useRef<InvoiceSaveCoordinator | null>(null);
  const [state, setState] = useState<SaveState>("저장됨");
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [tab, setTab] = useState("input");
  const [missing, setMissing] = useState<InvoiceMissingField[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const [uploading, setUploading] = useState(false);
  const uploadPending = useRef(false);
  const dragged = useRef<string | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const removeListener = useRef<(() => void) | null>(null);
  const notify = useToastStore((s) => s.show);

  function failure(reason: unknown) {
    const message = reason instanceof Error ? reason.message : "요청 실패";
    setError(message);
    if (reason instanceof ApiRequestError) {
      setField(reason.error.field);
      if (reason.status === 404 || reason.status === 401) {
        latest.current = null;
        setInvoice(null);
        queue.current?.dispose();
      }
    }
    notify(message);
  }

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | undefined;
    setInvoice(null);
    latest.current = null;
    setError(null);
    setField(null);
    setState("저장됨");
    void invoicesApi
      .get(id ?? "")
      .then((result) => {
        if (cancelled) return;
        if (result.id !== id || !Array.isArray(result.content?.items))
          throw new Error("문서 응답 계약을 확인해 주세요.");
        latest.current = result;
        setInvoice(result);
        const coordinator = new InvoiceSaveCoordinator(
          invoiceSnapshot(result),
          async (value) => {
            try {
              await invoicesApi.save(result.id, value);
              if (!cancelled) {
                setError(null);
                setField(null);
              }
            } catch (reason) {
              if (!cancelled) failure(reason);
              throw reason;
            }
          },
          (value) => {
            if (!cancelled) setState(value);
          },
        );
        queue.current = coordinator;
        unregister = registerNavigationFlush(() => coordinator.flush());
      })
      .catch((reason) => {
        if (!cancelled) failure(reason);
      });
    return () => {
      cancelled = true;
      unregister?.();
      queue.current?.dispose();
      queue.current = null;
      frame.current?.remove();
      frame.current = null;
      removeListener.current?.();
      actionPending.current = false;
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
    content({
      items: latest.current!.content.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    });
  }
  function move(itemId: string, target: number) {
    const items = [...latest.current!.content.items];
    const start = items.findIndex((item) => item.id === itemId);
    if (start < 0 || target < 0 || target >= items.length) return;
    const [item] = items.splice(start, 1);
    items.splice(target, 0, item);
    content({ items });
  }
  async function action(run: () => Promise<void>) {
    if (actionPending.current || uploadPending.current) return;
    actionPending.current = true;
    setBusy(true);
    try {
      await queue.current?.flush();
      if (latest.current) await run();
    } catch (reason) {
      failure(reason);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  function print() {
    if (!latest.current || busy || uploading) return;
    const fields = invoiceMissingFields(latest.current.content);
    if (fields.length) {
      setMissing(fields);
      return;
    }
    void action(async () => {
      // Edits can arrive while flush is pending. Re-check the latest draft before opening the iframe.
      const fields = invoiceMissingFields(latest.current!.content);
      if (fields.length) {
        setMissing(fields);
        return;
      }
      const element = document.createElement("iframe");
      element.title = "견적서·청구서 인쇄";
      element.className = "invoice-print-frame";
      element.src = `/print/invoice/${encodeURIComponent(id!)}`;
      frame.current?.remove();
      removeListener.current?.();
      frame.current = element;
      const cleanup = () => {
        element.remove();
        frame.current = null;
        window.removeEventListener("message", done);
      };
      const done = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          event.source !== element.contentWindow
        )
          return;
        if (
          !["invoice-print-error", "invoice-print-finished"].includes(
            event.data?.type,
          )
        )
          return;
        if (event.data.type === "invoice-print-error")
          notify("인쇄 자료를 불러오지 못했습니다.");
        cleanup();
      };
      removeListener.current = cleanup;
      element.onerror = () => {
        notify("인쇄 화면을 열지 못했습니다.");
        cleanup();
      };
      window.addEventListener("message", done);
      document.body.appendChild(element);
    });
  }
  async function stamp(file?: File) {
    if (!file || uploadPending.current || !id) return;
    const target = id;
    uploadPending.current = true;
    setUploading(true);
    try {
      if (!["image/jpeg", "image/png"].includes(file.type))
        throw new Error("JPG·PNG만 선택해 주세요.");
      if (file.size > 2000000)
        throw new Error("직인은 2MB 이하만 선택해 주세요.");
      const result = await uploadPhoto(file);
      if (latest.current?.id === target)
        content({ stampPhotoId: result.photoId });
    } catch (reason) {
      failure(reason);
    } finally {
      uploadPending.current = false;
      setUploading(false);
    }
  }

  if (!invoice)
    return (
      <section className="invoices-library" data-testid="invoice-editor-state">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">자료 불러오는 중…</p>
        )}
        {error && (
          <button
            data-testid="invoice-editor-reload"
            onClick={() => setAttempt((n) => n + 1)}
          >
            다시 조회
          </button>
        )}
      </section>
    );
  const c = invoice.content;
  const totals = calculateInvoice(c.items, c.vatMode);
  const input = (
    label: string,
    key: string,
    value: string,
    onChange: (value: string) => void,
    type = "text",
  ) => (
    <label className="invoice-field" key={key}>
      {label}
      <input
        id={`invoice-${key}`}
        data-testid={`invoice-${key}`}
        type={type}
        value={value}
        aria-invalid={field?.endsWith(key) || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
  return (
    <section className="invoice-editor" data-testid="invoice-editor">
      <header className="invoice-toolbar">
        <button
          data-testid="A-INE-BACK"
          disabled={busy || uploading}
          onClick={() => void action(async () => navigate("/invoices"))}
        >
          ← 목록
        </button>
        {input("제목", "title", invoice.title, (title) => change({ title }))}
        <span role="status">{state}</span>
        {state === "저장 실패·다시 시도" && (
          <button
            data-testid="A-INE-RETRY"
            onClick={() => void action(async () => undefined)}
          >
            다시 시도
          </button>
        )}
        <label className="invoice-field">
          강조색
          <select
            data-testid="A-INE-COLOR"
            value={c.color}
            onChange={(e) =>
              content({ color: e.target.value as InvoiceContent["color"] })
            }
          >
            {colors.map((color) => (
              <option key={color}>{color}</option>
            ))}
          </select>
        </label>
        {invoice.doc_type === "quote" ? (
          <button
            data-testid="A-INE-CONVERT"
            disabled={busy || uploading}
            onClick={() =>
              void action(async () => {
                const result = await invoicesApi.convert(id!);
                navigate(`/invoices/${encodeURIComponent(result.id)}/edit`);
              })
            }
          >
            청구서로 변환
          </button>
        ) : (
          <label className="invoice-paid-control">
            <input
              data-testid="A-INE-PAID"
              type="checkbox"
              checked={invoice.paid}
              onChange={(e) => change({ paid: e.target.checked })}
            />
            입금 완료
          </label>
        )}
        <button
          className="primary"
          data-testid="A-INE-PDF"
          disabled={busy || uploading}
          onClick={print}
        >
          PDF 내보내기
        </button>
      </header>
      {error && (
        <p role="alert" className="invoice-error">
          {field && `${field}: `}
          {error}
        </p>
      )}
      <div className="invoice-mobile-tabs">
        <button
          data-testid="A-INE-TAB-INPUT"
          aria-pressed={tab === "input"}
          onClick={() => setTab("input")}
        >
          입력
        </button>
        <button
          data-testid="A-INE-TAB-PREVIEW"
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </div>
      <div className="invoice-panes" data-tab={tab}>
        <div className="invoice-form" data-testid="invoice-input-panel">
          <section className="invoice-section">
            <h2>1. 문서 정보</h2>
            <p>
              문서번호: {invoice.doc_no} ·{" "}
              {invoice.doc_type === "quote" ? "견적서" : "청구서"}
            </p>
            {input(
              "발행일",
              "issueDate",
              c.issueDate,
              (issueDate) => content({ issueDate }),
              "date",
            )}
            {invoice.doc_type === "quote"
              ? input(
                  "유효기한",
                  "validUntil",
                  c.validUntil ?? "",
                  (validUntil) => content({ validUntil }),
                  "date",
                )
              : input(
                  "지급기한",
                  "dueDate",
                  c.dueDate ?? "",
                  (dueDate) => content({ dueDate }),
                  "date",
                )}
          </section>
          <section className="invoice-section">
            <h2>2. 공급자</h2>
            {(
              [
                ["name", "공급자 상호"],
                ["bizNo", "사업자등록번호"],
                ["ceo", "대표자"],
                ["address", "주소"],
                ["phone", "연락처"],
              ] as const
            ).map(([key, label]) =>
              input(label, `supplier-${key}`, c.supplier[key], (value) =>
                content({
                  supplier: {
                    ...latest.current!.content.supplier,
                    [key]: value,
                  },
                }),
              ),
            )}
            {c.supplier.bizNo &&
              !/^\d{3}-\d{2}-\d{5}$/.test(c.supplier.bizNo) && (
                <p className="invoice-warning">
                  사업자등록번호 NNN-NN-NNNNN 형식을 확인해 주세요. 저장은
                  가능합니다.
                </p>
              )}
            <label className="invoice-field">
              직인 이미지 선택 · JPG·PNG 2MB 이하
              <input
                data-testid="A-INE-STAMP-SELECT"
                type="file"
                accept="image/jpeg,image/png"
                disabled={uploading}
                onChange={(e) => {
                  void stamp(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {uploading && <p role="status">직인 업로드 중…</p>}
            {c.stampPhotoId && (
              <button
                data-testid="invoice-stamp-unlink"
                onClick={() => content({ stampPhotoId: null })}
              >
                직인 연결 해제
              </button>
            )}
          </section>
          <section className="invoice-section">
            <h2>3. 수신자</h2>
            {input("수신자 상호", "client-name", c.client.name, (name) =>
              content({ client: { ...c.client, name } }),
            )}
            {input("담당자", "client-contact", c.client.contact, (contact) =>
              content({ client: { ...c.client, contact } }),
            )}
          </section>
          <section className="invoice-section">
            <h2>4. 품목</h2>
            {c.items.map((item, index) => (
              <div
                key={item.id}
                className="invoice-item"
                data-testid={`invoice-item-${item.id}`}
                draggable
                onDragStart={() => {
                  dragged.current = item.id;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged.current) move(dragged.current, index);
                }}
              >
                <h3>품목 {index + 1}</h3>
                {(
                  [
                    ["name", "품명"],
                    ["spec", "규격"],
                    ["note", "품목 비고"],
                  ] as const
                ).map(([key, label]) =>
                  input(
                    `${index + 1}번째 ${label}`,
                    `item-${item.id}-${key}`,
                    item[key],
                    (value) => itemChange(item.id, { [key]: value }),
                  ),
                )}
                {(
                  [
                    ["qty", "수량", 99999],
                    ["unitPrice", "단가", 999999999],
                  ] as const
                ).map(([key, label, max]) => (
                  <label className="invoice-field" key={key}>
                    {index + 1}번째 {label}
                    <input
                      id={`invoice-item-${item.id}-${key}`}
                      data-testid={`invoice-item-${item.id}-${key}`}
                      type="number"
                      min={0}
                      max={max}
                      step={1}
                      value={item[key]}
                      onChange={(e) => {
                        const value = invoiceInteger(e.target.value, max);
                        if (value === null) {
                          setError(`${label}는 0~${max} 정수만 입력해 주세요.`);
                          return;
                        }
                        setError(null);
                        itemChange(item.id, { [key]: value });
                      }}
                    />
                  </label>
                ))}
                <output>
                  금액: {(item.qty * item.unitPrice).toLocaleString("ko-KR")}원
                </output>
                <div className="invoice-actions">
                  <button
                    data-testid={`invoice-item-up-${item.id}`}
                    disabled={!index}
                    onClick={() => move(item.id, index - 1)}
                  >
                    위로
                  </button>
                  <button
                    data-testid={`invoice-item-down-${item.id}`}
                    disabled={index === c.items.length - 1}
                    onClick={() => move(item.id, index + 1)}
                  >
                    아래로
                  </button>
                  <button
                    data-testid={`A-INE-ITEM-DELETE-${item.id}`}
                    onClick={() =>
                      content({
                        items: c.items.filter((row) => row.id !== item.id),
                      })
                    }
                  >
                    품목 삭제
                  </button>
                </div>
              </div>
            ))}
            <button
              id="invoice-add-item"
              data-testid="A-INE-ITEM-ADD"
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
              + 품목 추가
            </button>
          </section>
          <section className="invoice-section">
            <h2>5. 부가세 방식</h2>
            <label className="invoice-field">
              부가세 방식
              <select
                data-testid="invoice-vat-mode"
                value={c.vatMode}
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
            <p>공급가액 {totals.supply_amount.toLocaleString("ko-KR")}원</p>
            <p>
              부가세 {totals.vat_amount.toLocaleString("ko-KR")}원 · 합계{" "}
              {totals.total_amount.toLocaleString("ko-KR")}원
            </p>
          </section>
          <section className="invoice-section">
            <h2>6. 비고</h2>
            <label className="invoice-field">
              비고
              <textarea
                data-testid="invoice-notes"
                value={c.notes}
                onChange={(e) => content({ notes: e.target.value })}
              />
            </label>
          </section>
          {invoice.doc_type === "invoice" && (
            <section className="invoice-section">
              <h2>7. 입금 계좌</h2>
              {input(
                "입금 계좌",
                "bankAccount",
                c.bankAccount ?? "",
                (bankAccount) => content({ bankAccount }),
              )}
            </section>
          )}
        </div>
        <div className="invoice-preview" data-testid="invoice-preview-panel">
          <InvoiceRenderer invoice={{ ...invoice, ...totals }} />
        </div>
      </div>
      {missing && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="빠진 항목"
            data-testid="invoice-missing-modal"
          >
            <h2>빠진 항목</h2>
            {missing.map((value) => (
              <button
                key={value.id}
                data-testid={`invoice-missing-${value.id}`}
                onClick={() => {
                  setMissing(null);
                  setTab("input");
                  requestAnimationFrame(() =>
                    document.getElementById(`invoice-${value.id}`)?.focus(),
                  );
                }}
              >
                {value.label}
              </button>
            ))}
            <button
              data-testid="A-INE-MISSING-CLOSE"
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
