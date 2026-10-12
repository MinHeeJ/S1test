import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../shared/Icon";
import { Link, useNavigate } from "react-router-dom";
import type { Resume, ResumeTemplate } from "../../domain/resume/types";
import { ApiRequestError } from "../../shared/apiClient";
import { resumeApi } from "./api";
import { ResumeSession } from "./ResumeSession";
import { ResumeDialog, Toast } from "./ResumeFeedback";
import { ResumePreview } from "./ResumePreview";
import "./resumes.css";

type Action =
  | { kind: "create" }
  | { kind: "rename" | "delete"; resume: Resume };
export function ResumeListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Resume[]>();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const notify = useCallback((value: string) => setMessage(value), []);
  const clear = useCallback(() => setMessage(""), []);
  const [menu, setMenu] = useState<string>();
  const library = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest(".resume-menu, .card-menu-trigger"))
        setMenu(undefined);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      library.current
        ?.querySelector<HTMLButtonElement>(
          ".card-menu-trigger[aria-expanded=true]",
        )
        ?.focus();
      setMenu(undefined);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  const [action, setAction] = useState<Action>();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ResumeTemplate>();
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const handleError = useCallback(
    (value: unknown) => {
      if (value instanceof ApiRequestError && value.status === 401)
        navigate("/login");
      return value instanceof Error
        ? value.message
        : "요청을 처리하지 못했습니다.";
    },
    [navigate],
  );
  const load = useCallback(async () => {
    setRows(undefined);
    setError("");
    try {
      const result = await resumeApi.list(page);
      if (!result.data) throw new Error("목록 데이터를 가져오지 못했습니다.");
      setRows(result.data);
      setTotalPages(Number(result.meta.totalPages));
    } catch (value) {
      setError(handleError(value));
    }
  }, [page, handleError]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = (value: Action) => {
    setAction(value);
    setMenu(undefined);
    setFieldError("");
    setTemplateError("");
    setTitle(value.kind === "create" ? "새 이력서" : value.resume.title);
    setTemplate(undefined);
  };
  const submit = async () => {
    if (!action || busy) return;
    setFieldError("");
    setTemplateError("");
    if (action.kind !== "delete" && !title.trim()) {
      setFieldError("제목을 입력해 주세요.");
      return;
    }
    if (action.kind === "create" && !template) return;
    setBusy(true);
    try {
      if (action.kind === "create") {
        const result = await resumeApi.create(title, template!);
        if (!result.data?.id)
          throw new Error(
            "생성 결과를 확인하지 못했습니다. 자동 재시도하지 않습니다.",
          );
        navigate(`/resumes/${encodeURIComponent(result.data.id)}/edit`);
      } else {
        if (action.kind === "rename")
          await resumeApi.rename(action.resume.id, title);
        else await resumeApi.remove(action.resume.id);
        setAction(undefined);
        notify("완료되었습니다.");
        await load();
      }
    } catch (value) {
      if (value instanceof ApiRequestError && value.error.field === "title")
        setFieldError(value.message);
      if (value instanceof ApiRequestError && value.error.field === "template")
        setTemplateError(value.message);
      notify(handleError(value));
    } finally {
      setBusy(false);
    }
  };
  const duplicate = async (row: Resume) => {
    if (busy) return;
    setBusy(true);
    setMenu(undefined);
    try {
      await resumeApi.duplicate(row.id);
      notify("이력서를 복제했습니다.");
      await load();
    } catch (value) {
      notify(handleError(value));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResumeSession notify={notify}>
      <main className="page-content library-page" id="main-content">
        <div className="library-header">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>내 이력서</h1>
          <p>경험을 정리하고, 다음 기회를 준비하세요.</p>
        </div>
        <div className="library-toolbar">
          <span className="library-tab" aria-current="page">
            <Icon name="document" /> 내 이력서
          </span>
          <span className="meta">최근 수정순</span>
        </div>
        {error && (
          <div className="feedback-panel" role="alert">
            <Icon name="warning" />
            {error}
            <button onClick={() => void load()}>다시 시도</button>
          </div>
        )}
        {!rows && !error && (
          <section
            className="library-loading"
            role="status"
            aria-label="목록 불러오는 중"
          >
            <span className="sr-only">목록 불러오는 중…</span>
            <div className="resume-grid" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="skeleton-card" key={index}>
                  <div className="skeleton-paper" />
                  <div className="skeleton-label" />
                </div>
              ))}
            </div>
          </section>
        )}
        {rows && (
          <>
            {rows.length === 0 && (
              <section className="library-empty">
                <span className="empty-icon">
                  <Icon name="document" size={26} />
                </span>
                <h2>첫 이력서부터 시작해 보세요.</h2>
                <p>아직 이력서가 없습니다. 새 이력서를 작성해 보세요.</p>
              </section>
            )}
            <div className="resume-grid" ref={library}>
              <button
                className="create-card"
                disabled={busy}
                onClick={() => open({ kind: "create" })}
              >
                <span className="create-symbol" aria-hidden="true">
                  <Icon name="plus" size={24} />
                </span>
                <span>+ 새 이력서</span>
                <span className="create-helper" aria-hidden="true">
                  classic 또는 modern으로 시작
                </span>
              </button>
              {rows.map((row) => (
                <article className="resume-card" key={row.id}>
                  <Link
                    className="thumbnail-link"
                    to={`/resumes/${encodeURIComponent(row.id)}/edit`}
                    aria-label={row.title}
                  >
                    <ResumePreview resume={row} thumbnail />
                  </Link>
                  <div className="card-metadata">
                    <div>
                      <Link to={`/resumes/${encodeURIComponent(row.id)}/edit`}>
                        {row.title}
                      </Link>
                      {row.updated_at && (
                        <time dateTime={row.updated_at}>
                          {new Date(row.updated_at).toLocaleString("ko-KR")}
                        </time>
                      )}
                    </div>
                    <button
                      className="card-menu-trigger secondary"
                      aria-haspopup="true"
                      aria-label={`${row.title} 메뉴`}
                      aria-expanded={menu === row.id}
                      disabled={busy}
                      onClick={() =>
                        setMenu(menu === row.id ? undefined : row.id)
                      }
                    >
                      ⋯
                    </button>
                  </div>
                  {menu === row.id && (
                    <div
                      className="resume-menu"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setMenu(undefined);
                      }}
                    >
                      <button
                        onClick={() => open({ kind: "rename", resume: row })}
                      >
                        <Icon name="edit" /> 이름 변경
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void duplicate(row)}
                      >
                        <Icon name="copy" /> 복제
                      </button>
                      <button
                        className="danger"
                        onClick={() => open({ kind: "delete", resume: row })}
                      >
                        <Icon name="trash" /> 삭제
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="pagination" aria-label="목록 페이지">
              <button
                disabled={page === 0 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                이전
              </button>
              <span>
                {page + 1} / {Math.max(totalPages, 1)}
              </span>
              <button
                disabled={page + 1 >= totalPages || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </button>
            </div>
          </>
        )}
        {action && (
          <ResumeDialog
            title={
              action.kind === "create"
                ? "새 이력서 생성"
                : action.kind === "rename"
                  ? "이름 변경"
                  : "이력서 삭제 확인"
            }
            busy={busy}
            cancel={() => setAction(undefined)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {action.kind === "delete" ? (
                <p>{action.resume.title} 이력서를 삭제하시겠습니까?</p>
              ) : (
                <>
                  <label>
                    제목
                    <input
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={fieldError ? "title-error" : undefined}
                      value={title}
                      disabled={busy}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>
                  {fieldError && (
                    <p role="alert" className="field-warning" id="title-error">
                      {fieldError}
                    </p>
                  )}
                </>
              )}
              {action.kind === "create" && (
                <fieldset className="template-options" disabled={busy}>
                  <legend>템플릿</legend>
                  {(["classic", "modern"] as const).map((value) => (
                    <label
                      className={`template-option ${template === value ? "selected" : ""}`}
                      key={value}
                    >
                      <input
                        type="radio"
                        name="template"
                        aria-invalid={Boolean(templateError)}
                        aria-describedby={
                          templateError ? "template-error" : undefined
                        }
                        checked={template === value}
                        onChange={() => setTemplate(value)}
                      />
                      {value}
                    </label>
                  ))}
                  {templateError && (
                    <p
                      role="alert"
                      className="field-warning"
                      id="template-error"
                    >
                      {templateError}
                    </p>
                  )}
                </fieldset>
              )}
              <button
                className={action.kind === "delete" ? "danger" : "primary"}
                disabled={busy || (action.kind === "create" && !template)}
              >
                {busy
                  ? "처리 중…"
                  : action.kind === "create"
                    ? "생성"
                    : action.kind === "rename"
                      ? "저장"
                      : "확인"}
              </button>
            </form>
          </ResumeDialog>
        )}
        <Toast message={message} clear={clear} />
      </main>
    </ResumeSession>
  );
}
