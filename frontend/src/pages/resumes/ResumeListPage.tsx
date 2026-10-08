import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Resume, ResumeTemplate } from "../../domain/resume/types";
import { ApiError } from "../../api/apiClient";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { Modal } from "../../shared/Modal";
import { Toast } from "../../shared/Toast";
import { resumesApi } from "./resumesApi";
import { ResumeThumbnail } from "./ResumeThumbnail";
import { ResumeSession } from "./ResumeSession";
import "./resumes.css";

/** Paginated DB-backed document grid with server-refresh after every list mutation. */
export function ResumeListPage() {
  const [rows, setRows] = useState<Resume[]>([]);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "rename">();
  const [selected, setSelected] = useState<Resume>();
  const [deleting, setDeleting] = useState<Resume>();
  const [title, setTitle] = useState("새 이력서");
  const [template, setTemplate] = useState<ResumeTemplate>("classic");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const fail = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401)
      navigate("/login", { replace: true });
    else
      setError(error instanceof Error ? error.message : "요청에 실패했습니다.");
  };
  const actionFail = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      navigate("/login", { replace: true });
      return;
    }
    const message =
      error instanceof Error ? error.message : "요청에 실패했습니다.";
    setActionError(message);
    setErrorField(error instanceof ApiError ? error.field : null);
    setToast(message);
  };
  const load = async (completedAction?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await resumesApi.list(page, 20, filter);
      setRows(response.data!);
      setTotal(Number(response.meta.total));
      if (page > 0 && response.data!.length === 0) setPage(page - 1);
      return true;
    } catch (error) {
      setRows([]);
      if (
        completedAction &&
        !(error instanceof ApiError && error.status === 401)
      ) {
        setError(
          `${completedAction} 작업은 완료되었지만 목록을 확인하지 못했습니다. ${
            error instanceof Error ? error.message : "조회 실패"
          }`,
        );
      } else fail(error);
      return false;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [page, filter]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setActionError("");
    setErrorField(null);
    try {
      if (modal === "create") {
        const response = await resumesApi.create(title, template);
        navigate(`/resumes/${encodeURIComponent(response.data!.id)}/edit`);
      } else if (selected) {
        await resumesApi.rename(selected.id, title);
        setModal(undefined);
        if (await load("이름 변경")) setToast("이름을 변경했습니다.");
      }
    } catch (error) {
      actionFail(error);
    } finally {
      setBusy(false);
    }
  };
  const duplicate = async (row: Resume) => {
    setBusy(true);
    try {
      await resumesApi.duplicate(row.id);
      if (await load("복제")) setToast("사본을 만들었습니다.");
    } catch (error) {
      actionFail(error);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await resumesApi.delete(deleting.id);
      setDeleting(undefined);
      if (await load("삭제")) setToast("이력서를 삭제했습니다.");
    } catch (error) {
      actionFail(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResumeSession>
      <div className="resume-library">
        <div className="library-heading">
          <div>
            <p className="eyebrow">나의 작업 공간</p>
            <h1>나의 이력서</h1>
            <p className="page-description">
              경험을 정리하고, 다음 기회를 준비하세요.
            </p>
          </div>
          {!loading && !error && (
            <span className="document-count">{total}개의 이력서</span>
          )}
        </div>
        <label className="library-search">
          제목 검색
          <input
            type="search"
            placeholder="제목으로 이력서 찾기"
            value={filter}
            onChange={(event) => {
              setPage(0);
              setFilter(event.target.value);
            }}
          />
        </label>
        {error && (
          <div role="alert" className="feedback-panel feedback-error">
            {error} <button onClick={() => void load()}>다시 시도</button>
          </div>
        )}
        {loading && (
          <div
            data-testid="library-skeleton"
            role="status"
            aria-label="이력서를 불러오는 중"
            className="library-skeleton"
          >
            <div />
            <div />
            <div />
            <span className="sr-only">이력서를 불러오는 중…</span>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="library-empty">
            <span className="empty-mark" aria-hidden="true">
              ＋
            </span>
            <h2>
              {filter ? "검색 결과가 없습니다." : "첫 이력서를 시작해보세요."}
            </h2>
            <p>이력서가 없습니다. 새 이력서를 만들어보세요.</p>
            {filter && (
              <button onClick={() => setFilter("")}>검색 초기화</button>
            )}
          </div>
        )}
        <div className="resume-grid">
          <button
            className="new-resume"
            onClick={() => {
              setTitle("새 이력서");
              setTemplate("classic");
              setModal("create");
              setError("");
              setActionError("");
              setErrorField(null);
            }}
          >
            + 새 이력서
          </button>
          {!loading &&
            rows.map((row) => (
              <article className="resume-card" key={row.id}>
                <ResumeThumbnail resume={row} />
                <div className="card-metadata">
                  <div>
                    <Link to={`/resumes/${encodeURIComponent(row.id)}/edit`}>
                      {row.title}
                    </Link>
                    <p>
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleString("ko-KR")
                        : ""}
                    </p>
                  </div>
                  <details>
                    <summary aria-label={`${row.title} 메뉴`}>⋯</summary>
                    <div className="card-menu">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelected(row);
                          setTitle(row.title);
                          setModal("rename");
                          setError("");
                          setActionError("");
                          setErrorField(null);
                        }}
                      >
                        이름 변경
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void duplicate(row)}
                      >
                        복제
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => setDeleting(row)}
                      >
                        삭제
                      </button>
                    </div>
                  </details>
                </div>
              </article>
            ))}
        </div>
        <nav aria-label="이력서 페이지" className="pagination">
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage(page - 1)}
          >
            이전
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(total / 20))}
          </span>
          <button
            disabled={(page + 1) * 20 >= total || loading}
            onClick={() => setPage(page + 1)}
          >
            다음
          </button>
        </nav>
      </div>
      {modal && (
        <Modal
          title={modal === "create" ? "새 이력서" : "이름 변경"}
          busy={busy}
          onClose={() => setModal(undefined)}
        >
          <p className="page-description">
            {modal === "create"
              ? "제목과 템플릿을 선택하고 작성을 시작하세요."
              : "목록에 표시할 제목을 변경하세요."}
          </p>
          {actionError && (
            <p id="resume-action-error" role="alert" className="field-warning">
              {actionError}
            </p>
          )}
          <form onSubmit={(event) => void submit(event)}>
            <label>
              제목
              <input
                autoFocus
                aria-invalid={errorField === "title"}
                aria-describedby={
                  errorField === "title" ? "resume-action-error" : undefined
                }
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            {modal === "create" && (
              <label>
                템플릿
                <select
                  aria-invalid={errorField === "template"}
                  aria-describedby={
                    errorField === "template"
                      ? "resume-action-error"
                      : undefined
                  }
                  value={template}
                  onChange={(event) =>
                    setTemplate(event.target.value as ResumeTemplate)
                  }
                >
                  <option value="classic">classic</option>
                  <option value="modern">modern</option>
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModal(undefined)}
              >
                취소
              </button>
              <button
                className="primary"
                aria-busy={busy}
                disabled={busy || !title.trim()}
              >
                {modal === "create" ? "생성" : "저장"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="이력서를 삭제하시겠습니까?"
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => void remove()}
        busy={busy}
      >
        {deleting?.title}
      </ConfirmDialog>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </ResumeSession>
  );
}
export default ResumeListPage;
