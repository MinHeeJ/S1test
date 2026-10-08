import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Resume, ResumeTemplate } from "../../domain/resume/types";
import { resumeApi, ResumeApiError } from "./resumeApi";
import { ResumeThumbnail } from "./ResumeThumbnail";
import { ResumeDialog, ResumeSession, ResumeToast } from "./ResumeSession";

/** Saved owner-scoped cards and their create/rename/delete dialogs. Pages are read until exhausted. */
export function ResumeListPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [selected, setSelected] = useState<Resume>();
  const [title, setTitle] = useState("새 이력서");
  const [template, setTemplate] = useState<ResumeTemplate>("classic");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const requestVersion = useRef(0);
  const clear = useCallback(() => setToast(""), []);
  const close = useCallback(() => {
    if (!busy) {
      setDialog(null);
      setDialogError("");
    }
  }, [busy]);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const all: Resume[] = [];
      for (let page = 0; ; page++) {
        const rows = await resumeApi.list(page, 20, filter || undefined);
        all.push(...rows);
        if (rows.length < 20) break;
      }
      if (version !== requestVersion.current) return false;
      setResumes(all);
      return true;
    } catch (error) {
      if (version !== requestVersion.current) return false;
      setResumes([]);
      if (error instanceof ResumeApiError && error.status === 401)
        navigate("/login");
      setError(
        error instanceof Error ? error.message : "목록을 불러오지 못했습니다.",
      );
      return false;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [filter, navigate]);
  useEffect(() => {
    void load();
    return () => {
      requestVersion.current++;
    };
  }, [load]);
  async function submit() {
    if (busy) return;
    if (dialog !== "delete" && !title.trim()) {
      setDialogError("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      if (dialog === "create") {
        const created = await resumeApi.create(title, template);
        navigate(`/resumes/${created.id}/edit`);
      } else if (selected) {
        if (dialog === "rename") await resumeApi.rename(selected.id, title);
        if (dialog === "delete") await resumeApi.remove(selected.id);
        setDialog(null);
        const refreshed = await load();
        setToast(
          refreshed
            ? "변경되었습니다."
            : "변경은 저장되었지만 목록을 갱신하지 못했습니다.",
        );
      }
    } catch (error) {
      if (error instanceof ResumeApiError && error.status === 401)
        navigate("/login");
      setDialogError(
        error instanceof Error ? error.message : "요청에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(resume: Resume) {
    if (busy) return;
    setBusy(true);
    try {
      await resumeApi.duplicate(resume.id);
      const refreshed = await load();
      setToast(
        refreshed
          ? "사본이 생성되었습니다."
          : "사본은 생성되었지만 목록을 갱신하지 못했습니다.",
      );
    } catch (error) {
      if (error instanceof ResumeApiError && error.status === 401)
        navigate("/login");
      setToast(error instanceof Error ? error.message : "복제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ResumeSession>
      <div className="resume-library">
        <header className="resume-library-heading">
          <div>
            <p className="resume-eyebrow">YOUR WORK, YOUR STORY</p>
            <h1>내 이력서</h1>
            <p>경험을 정리하고, 나에게 맞는 다음 기회를 준비하세요.</p>
          </div>
        </header>
        <div className="resume-library-tools">
          <label>
            제목 검색
            <input value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <span className="resume-count">{resumes.length}개 이력서</span>
        </div>
        {error && (
          <div className="resume-error-state" role="alert">
            {error}
            <button onClick={() => void load()}>다시 시도</button>
          </div>
        )}
        {loading && (
          <div
            className="resume-card-grid"
            data-testid="resume-library-loading"
            role="status"
          >
            <span className="sr-only">이력서를 불러오는 중…</span>
            {Array.from({ length: 6 }, (_, index) => (
              <div className="resume-card" key={index} aria-hidden="true">
                <div className="resume-skeleton resume-skeleton-paper" />
                <div className="resume-skeleton resume-skeleton-title" />
              </div>
            ))}
          </div>
        )}
        {!loading && !error && (
          <div className="resume-card-grid">
            <button
              className="resume-create-card"
              aria-label="+ 새 이력서"
              onClick={() => {
                setTitle("새 이력서");
                setTemplate("classic");
                setDialog("create");
                setDialogError("");
              }}
            >
              <span className="resume-create-icon" aria-hidden="true">
                +
              </span>
              <span>+ 새 이력서</span>
              <small>새로운 이야기를 시작하세요</small>
            </button>
            {resumes.map((resume) => (
              <article className="resume-card" key={resume.id}>
                <Link
                  to={`/resumes/${resume.id}/edit`}
                  aria-label={`${resume.title} 편집`}
                  className="resume-thumbnail"
                >
                  <ResumeThumbnail resume={resume} />
                </Link>
                <div className="resume-card-meta">
                  <div>
                    <h3>{resume.title}</h3>
                    <small>
                      {resume.updated_at &&
                        new Date(resume.updated_at).toLocaleString("ko-KR")}
                    </small>
                  </div>
                  <details>
                    <summary aria-label={`${resume.title} 작업`}>⋯</summary>
                    <button
                      onClick={() => {
                        setSelected(resume);
                        setTitle(resume.title);
                        setDialog("rename");
                        setDialogError("");
                      }}
                    >
                      이름 변경
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void duplicate(resume)}
                    >
                      복제
                    </button>
                    <button
                      onClick={() => {
                        setSelected(resume);
                        setDialog("delete");
                        setDialogError("");
                      }}
                    >
                      삭제
                    </button>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && !resumes.length && (
          <div className="resume-empty-state">
            <p>
              {filter ? "검색 결과가 없습니다." : "첫 이력서를 만들어 보세요."}
            </p>
            <small>
              {filter
                ? "다른 제목으로 검색해 보세요."
                : "새 이력서에서 템플릿을 선택하고 작성을 시작하세요."}
            </small>
            {filter && (
              <button onClick={() => setFilter("")}>검색 초기화</button>
            )}
          </div>
        )}
        {dialog && (
          <ResumeDialog
            title={
              dialog === "create"
                ? "새 이력서"
                : dialog === "rename"
                  ? "이름 변경"
                  : "이력서 삭제"
            }
            close={close}
          >
            {dialog === "delete" ? (
              <p>
                “{selected?.title}”을 삭제하시겠습니까? 삭제 후 복구할 수
                없습니다.
              </p>
            ) : (
              <>
                <label>
                  제목
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy}
                    aria-invalid={!!dialogError}
                    aria-describedby={
                      dialogError ? "resume-dialog-error" : undefined
                    }
                  />
                </label>
                {dialog === "create" && (
                  <label>
                    템플릿
                    <select
                      disabled={busy}
                      value={template}
                      onChange={(e) =>
                        setTemplate(e.target.value as ResumeTemplate)
                      }
                    >
                      <option value="classic">Classic</option>
                      <option value="modern">Modern</option>
                    </select>
                  </label>
                )}
              </>
            )}
            {dialogError && (
              <p id="resume-dialog-error" role="alert">
                {dialogError}
              </p>
            )}
            <button
              className={dialog === "delete" ? "danger" : "primary"}
              disabled={busy}
              aria-busy={busy}
              onClick={() => void submit()}
            >
              {busy
                ? "처리 중…"
                : dialog === "create"
                  ? "생성"
                  : dialog === "rename"
                    ? "저장"
                    : "삭제 확인"}
            </button>
          </ResumeDialog>
        )}
        <ResumeToast message={toast} clear={clear} />
      </div>
    </ResumeSession>
  );
}
