import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../shared/apiClient";
import type { Resume, ResumeTemplate } from "../../domain/resume/types";
import { resumesApi } from "./api";
import { ResumeRenderer } from "./ResumeRenderer";
import {
  errorMessage,
  ResumeDialog,
  ResumeHeader,
  Toast,
  useToast,
} from "./ResumeSession";
import "./resumes.css";

type Dialog =
  | { kind: "create" }
  | { kind: "rename" | "delete"; resume: Resume };
export function ResumeListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Resume[]>([]);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<Dialog>();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ResumeTemplate>("classic");
  const [menu, setMenu] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const { toast, message } = useToast();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setRows([]);
    setError("");
    resumesApi
      .list(page)
      .then((result) => {
        if (!active) return;
        const totalPages = Number(result.meta.totalPages);
        if (!result.data.length && page > 0 && totalPages <= page) {
          setPage(Math.max(0, totalPages - 1));
          return;
        }
        setRows(result.data);
        setPages(totalPages);
      })
      .catch((failure) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401)
          navigate("/login");
        else setError(errorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision, navigate]);
  function open(value: Dialog) {
    setDialog(value);
    setTitle(value.kind === "create" ? "새 이력서" : value.resume.title);
    setTemplate("classic");
    setFieldError("");
    setErrorField(null);
    setMenu(undefined);
  }
  async function submit() {
    if (!dialog || busy) return;
    if (dialog.kind !== "delete" && !title.trim()) {
      setFieldError("제목을 입력해 주세요.");
      setErrorField("title");
      return;
    }
    setBusy(true);
    setFieldError("");
    setErrorField(null);
    try {
      if (dialog.kind === "create") {
        const response = await resumesApi.create(title.trim(), template);
        navigate(`/resumes/${encodeURIComponent(response.data.id)}/edit`);
      } else if (dialog.kind === "rename") {
        await resumesApi.rename(dialog.resume.id, title.trim());
        toast("이름을 변경했습니다.");
      } else {
        await resumesApi.delete(dialog.resume.id);
        toast("이력서를 삭제했습니다.");
      }
      setDialog(undefined);
      setRevision((value) => value + 1);
    } catch (failure) {
      setFieldError(errorMessage(failure));
      setErrorField(failure instanceof ApiError ? failure.body.field : null);
      toast(errorMessage(failure));
      if (failure instanceof ApiError && failure.status === 401)
        navigate("/login");
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(resume: Resume) {
    if (busy) return;
    setBusy(true);
    setMenu(undefined);
    try {
      await resumesApi.duplicate(resume.id);
      setPage(0);
      setRevision((value) => value + 1);
      toast("이력서를 복제했습니다.");
    } catch (failure) {
      toast(errorMessage(failure));
      if (failure instanceof ApiError && failure.status === 401)
        navigate("/login");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="resumes-page">
      <ResumeHeader />
      <div className="resumes-library">
        <div className="resumes-library-heading">
          <div>
            <p className="resumes-eyebrow">YOUR WORKSPACE</p>
            <h1>내 이력서</h1>
            <p className="resumes-description">
              경험을 정리하고, 나다운 이력서를 완성하세요.
            </p>
          </div>
          <span className="resumes-sort">최근 수정순</span>
        </div>
        {loading && (
          <div
            className="resumes-loading"
            role="status"
            aria-label="이력서 목록을 불러오는 중"
          >
            <div className="resumes-skeleton" />
            <span>이력서 목록을 불러오는 중…</span>
          </div>
        )}
        {error && (
          <div className="resumes-feedback">
            <p role="alert">{error}</p>
            <button onClick={() => setRevision((value) => value + 1)}>
              다시 시도
            </button>
          </div>
        )}
        {!loading && !error && (
          <>
            {!rows.length && (
              <div className="resumes-empty">
                <h2>첫 이력서, 여기서 시작하세요.</h2>
                <p>아직 이력서가 없습니다. 새 이력서를 작성해 보세요.</p>
              </div>
            )}
            <div className="resumes-grid">
              <button
                className="resumes-create"
                aria-label="+ 새 이력서"
                disabled={busy}
                onClick={() => open({ kind: "create" })}
              >
                <span className="resumes-create-icon" aria-hidden="true">
                  +
                </span>
                <strong>새 이력서</strong>
                <span className="resumes-meta">
                  새로운 기회를 위한 첫 페이지
                </span>
              </button>
              {rows.map((resume) => (
                <article className="resumes-card" key={resume.id}>
                  <Link
                    className="resumes-thumbnail"
                    to={`/resumes/${encodeURIComponent(resume.id)}/edit`}
                  >
                    <ResumeRenderer {...resume} thumbnail />
                    <span className="resumes-sr">{resume.title} 편집</span>
                  </Link>
                  <div className="resumes-card-meta">
                    <div>
                      <h3>
                        <Link
                          to={`/resumes/${encodeURIComponent(resume.id)}/edit`}
                        >
                          {resume.title}
                        </Link>
                      </h3>
                      <time
                        className="resumes-meta"
                        dateTime={resume.updated_at}
                      >
                        {resume.updated_at
                          ? new Date(resume.updated_at).toLocaleString("ko-KR")
                          : ""}
                      </time>
                    </div>
                    <button
                      aria-label={`${resume.title} 메뉴`}
                      aria-expanded={menu === resume.id}
                      disabled={busy}
                      onClick={() =>
                        setMenu(menu === resume.id ? undefined : resume.id)
                      }
                    >
                      ⋯
                    </button>
                  </div>
                  {menu === resume.id && (
                    <div className="resumes-menu">
                      <button onClick={() => open({ kind: "rename", resume })}>
                        이름 변경
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void duplicate(resume)}
                      >
                        복제
                      </button>
                      <button onClick={() => open({ kind: "delete", resume })}>
                        삭제
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <nav aria-label="이력서 페이지" className="resumes-pagination">
              <button
                disabled={page === 0 || busy}
                onClick={() => setPage(page - 1)}
              >
                이전
              </button>
              <span>
                {page + 1} / {Math.max(1, pages)}
              </span>
              <button
                disabled={page + 1 >= pages || busy}
                onClick={() => setPage(page + 1)}
              >
                다음
              </button>
            </nav>
          </>
        )}
      </div>
      {dialog && (
        <ResumeDialog
          title={
            dialog.kind === "create"
              ? "새 이력서"
              : dialog.kind === "rename"
                ? "이름 변경"
                : "이력서 삭제"
          }
          busy={busy}
          close={() => setDialog(undefined)}
        >
          {dialog.kind === "delete" ? (
            <p>“{dialog.resume.title}” 이력서를 삭제하시겠습니까?</p>
          ) : (
            <>
              <label>
                제목
                <input
                  value={title}
                  aria-label="제목"
                  aria-invalid={Boolean(fieldError) && errorField === "title"}
                  aria-describedby={
                    fieldError && errorField === "title"
                      ? "resume-title-error"
                      : undefined
                  }
                  disabled={busy}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              {dialog.kind === "create" && (
                <label>
                  템플릿
                  <select
                    value={template}
                    aria-invalid={
                      Boolean(fieldError) && errorField === "template"
                    }
                    aria-describedby={
                      fieldError && errorField === "template"
                        ? "resume-title-error"
                        : undefined
                    }
                    disabled={busy}
                    onChange={(event) =>
                      setTemplate(event.target.value as ResumeTemplate)
                    }
                  >
                    <option value="classic">classic</option>
                    <option value="modern">modern</option>
                  </select>
                </label>
              )}
            </>
          )}
          {fieldError && (
            <p id="resume-title-error" role="alert">
              {fieldError}
            </p>
          )}
          <button
            className="resumes-primary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void submit()}
          >
            {dialog.kind === "create"
              ? "생성"
              : dialog.kind === "rename"
                ? "저장"
                : "삭제 확인"}
          </button>
        </ResumeDialog>
      )}
      <Toast message={message} />
    </div>
  );
}
