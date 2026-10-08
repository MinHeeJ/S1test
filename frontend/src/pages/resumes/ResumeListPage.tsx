import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { resumeApi } from "./resumeApi";
import { ResumeThumbnail } from "./ResumeThumbnail";
import {
  ResumeDialog,
  ResumeHeader,
  ResumeToast,
  useResumeFeedback,
} from "./ResumeFeedback";
import { ResumeLoading, ResumeNotice } from "./ResumeStates";
import "./resumes.css";

export function ResumeListPage() {
  const [rows, setRows] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [selected, setSelected] = useState<Resume>();
  const [menu, setMenu] = useState<string>();
  const [title, setTitle] = useState("새 이력서");
  const [template, setTemplate] = useState<Resume["template"]>("classic");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const navigate = useNavigate();
  const { toast, failure, message } = useResumeFeedback();
  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await resumeApi.all());
    } catch (cause) {
      setError("목록을 불러오지 못했습니다.");
      failure(cause);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function open(kind: "create" | "rename" | "delete", row?: Resume) {
    setSelected(row);
    setTitle(row?.title ?? "새 이력서");
    setTemplate("classic");
    setFieldError("");
    setMenu(undefined);
    setModal(kind);
  }
  async function submit() {
    if (modal !== "delete" && !title.trim()) {
      setFieldError("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      if (modal === "create")
        navigate(
          `/resumes/${await resumeApi.create(title.trim(), template)}/edit`,
        );
      if (modal === "rename")
        await resumeApi.rename(selected!.id, title.trim());
      if (modal === "delete") await resumeApi.remove(selected!.id);
      setModal(null);
      toast("완료되었습니다.");
      await load();
    } catch (cause) {
      failure(cause);
      setFieldError(
        cause instanceof Error ? cause.message : "다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(row: Resume) {
    setBusy(true);
    try {
      await resumeApi.duplicate(row.id);
      setMenu(undefined);
      toast("사본이 생성되었습니다.");
      await load();
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="resume-product">
      <ResumeHeader />
      <main className="resume-library">
        <header className="library-heading">
          <p className="resume-eyebrow">YOUR WORK, ON PAPER</p>
          <h1>내 이력서</h1>
          <p>당신의 경험을 정리하고, 다음 기회를 준비하세요.</p>
        </header>
        <div className="library-summary">
          <span>이력서 {loading || error ? "" : `${rows.length}개`}</span>
          <span>최근 수정순</span>
        </div>
        {loading && <ResumeLoading />}
        {error && (
          <ResumeNotice title={error} error retry={() => void load()}>
            연결 상태를 확인한 뒤 다시 시도해 주세요. 저장된 이력서는 변경되지
            않습니다.
          </ResumeNotice>
        )}
        {!loading && !error && rows.length === 0 && (
          <ResumeNotice title="아직 이력서가 없습니다.">
            새 이력서를 만들어 보세요. 작성한 내용은 자동으로 저장됩니다.
          </ResumeNotice>
        )}
        <div className="resume-grid">
          <button
            className="resume-create-card"
            aria-label="+ 새 이력서"
            disabled={loading || Boolean(error) || busy}
            onClick={() => open("create")}
          >
            <span className="create-symbol" aria-hidden="true">
              +
            </span>
            <strong>새 이력서</strong>
            <span>새로운 기회의 시작</span>
          </button>
          {!loading &&
            !error &&
            rows.map((row) => (
              <article key={row.id} className="resume-card">
                <Link
                  className="resume-thumbnail"
                  to={`/resumes/${row.id}/edit`}
                  aria-label={`${row.title} 편집`}
                >
                  <ResumeThumbnail resume={row} />
                </Link>
                <div className="resume-metadata">
                  <Link to={`/resumes/${row.id}/edit`}>{row.title}</Link>
                  <button
                    aria-label={`${row.title} 메뉴`}
                    aria-expanded={menu === row.id}
                    aria-haspopup="menu"
                    disabled={busy}
                    onClick={() =>
                      setMenu(menu === row.id ? undefined : row.id)
                    }
                  >
                    ⋯
                  </button>
                  <time>
                    {row.updated_at
                      ? new Date(row.updated_at).toLocaleString("ko-KR")
                      : ""}
                  </time>
                </div>
                {menu === row.id && (
                  <div className="resume-menu" role="menu">
                    <button role="menuitem" onClick={() => open("rename", row)}>
                      이름 변경
                    </button>
                    <button
                      role="menuitem"
                      disabled={busy}
                      onClick={() => void duplicate(row)}
                    >
                      복제
                    </button>
                    <button
                      className="danger"
                      role="menuitem"
                      onClick={() => open("delete", row)}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </article>
            ))}
        </div>
      </main>
      {modal && (
        <ResumeDialog
          title={
            modal === "create"
              ? "새 이력서"
              : modal === "rename"
                ? "이름 변경"
                : "이력서 삭제"
          }
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          {modal === "delete" ? (
            <p>“{selected?.title}”을 삭제할까요?</p>
          ) : (
            <>
              <label>
                제목
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              {modal === "create" && (
                <label>
                  템플릿
                  <select
                    value={template}
                    onChange={(event) =>
                      setTemplate(event.target.value as Resume["template"])
                    }
                  >
                    <option value="classic">classic</option>
                    <option value="modern">modern</option>
                  </select>
                </label>
              )}
            </>
          )}
          {fieldError && <p role="alert">{fieldError}</p>}
          <footer>
            <button disabled={busy} onClick={() => setModal(null)}>
              취소
            </button>
            <button
              className={modal === "delete" ? "danger-primary" : "primary"}
              aria-busy={busy}
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy
                ? "처리 중…"
                : modal === "create"
                  ? "생성"
                  : modal === "delete"
                    ? "삭제 확인"
                    : "저장"}
            </button>
          </footer>
        </ResumeDialog>
      )}
      <ResumeToast message={message} />
    </div>
  );
}
