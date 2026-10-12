import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../../app/AppShell";
import { useSessionStore } from "../../app/session";
import { ApiError } from "../../shared/api";
import { logout as logoutSession } from "../auth/authApi";
import { ConfirmModal } from "../../shared/ConfirmModal";
import { Dialog } from "../../shared/Dialog";
import { CardMenu } from "../../shared/CardMenu";
import { useToast } from "../../shared/Toast";
import { resumesApi } from "./api";
import { hasText, type Resume } from "./model";
import { ResumeThumbnail } from "./ResumeThumbnail";
import "./resumes.css";

export function ScResumes() {
  const navigate = useNavigate();
  const nickname = useSessionStore((state) => state.user?.nickname);
  const [rows, setRows] = useState<Resume[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("새 이력서");
  const [template, setTemplate] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [rename, setRename] = useState<Resume | null>(null);
  const [target, setTarget] = useState<Resume | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setError(null);
    try {
      setRows(await resumesApi.list());
      setError(null);
      return true;
    } catch {
      setRows(null);
      const message = "이력서 목록을 불러오지 못했습니다. 새로고침해 주세요.";
      setError(message);
      useToast.getState().show(message);
      return false;
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const report = (caught: unknown) => {
    const message =
      caught instanceof ApiError
        ? caught.body.message
        : "요청을 처리하지 못했습니다.";
    setFieldError(message);
    useToast.getState().show(message);
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasText(title) || !template || busy) return;
    setBusy(true);
    try {
      const result = await resumesApi.create(title, template);
      navigate(`/resumes/${encodeURIComponent(result.id)}/edit`);
    } catch (caught) {
      report(caught);
    } finally {
      setBusy(false);
    }
  };
  const execute = async (command: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await command();
      const refreshed = await load();
      useToast
        .getState()
        .show(
          refreshed
            ? "완료되었습니다."
            : "작업은 완료됐으나 목록을 갱신하지 못했습니다. 다시 시도해 주세요.",
        );
    } catch (caught) {
      report(caught);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    await logoutSession();
  };
  return (
    <AppShell nickname={nickname} onLogout={logout}>
      <div className="list-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>내 이력서</h1>
          <p className="page-description">
            나의 경험을 한 페이지에. 작성한 이력서는 자동으로 저장됩니다.
          </p>
        </div>
        {rows && <span className="document-count">{rows.length}개 문서</span>}
      </div>
      {error && (
        <div className="query-error">
          <p role="alert">{error}</p>
          <button onClick={() => void load()}>다시 시도</button>
        </div>
      )}
      {rows === null && !error && (
        <div className="list-loading">
          <p role="status">이력서를 불러오고 있습니다…</p>
          <div className="resume-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="document-skeleton" key={index} />
            ))}
          </div>
        </div>
      )}
      {rows && (
        <>
          {rows.length === 0 && (
            <div className="empty-state">
              <span className="empty-symbol" aria-hidden="true">
                ＋
              </span>
              <h2>첫 이력서를 시작해 보세요</h2>
              <p>아직 이력서가 없습니다. 새 이력서를 만들어 보세요.</p>
            </div>
          )}
          <div className="resume-grid">
            <button
              className="new-resume"
              onClick={() => {
                setCreating(true);
                setTitle("새 이력서");
                setTemplate("");
                setFieldError(null);
              }}
            >
              ＋ 새 이력서
            </button>
            {rows.map((row) => (
              <article className="resume-card" key={row.id}>
                <Link
                  to={`/resumes/${encodeURIComponent(row.id)}/edit`}
                  aria-label={`${row.title} 편집`}
                >
                  <ResumeThumbnail resume={row} />
                </Link>
                <div className="card-metadata">
                  {rename?.id === row.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!hasText(title)) {
                          setFieldError("제목을 입력해 주세요.");
                          return;
                        }
                        void execute(async () => {
                          await resumesApi.rename(row.id, title);
                          setRename(null);
                        });
                      }}
                    >
                      <input
                        aria-label="이력서 이름"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                      <button disabled={busy}>이름 저장</button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRename(null)}
                      >
                        취소
                      </button>
                      {fieldError && (
                        <p className="field-error" role="alert">
                          {fieldError}
                        </p>
                      )}
                    </form>
                  ) : (
                    <Link
                      className="document-title"
                      to={`/resumes/${encodeURIComponent(row.id)}/edit`}
                    >
                      {row.title}
                    </Link>
                  )}
                  <time dateTime={row.updated_at}>
                    {new Date(row.updated_at).toLocaleString("ko-KR")}
                  </time>
                </div>
                <CardMenu title={row.title}>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setRename(row);
                      setTitle(row.title);
                      setFieldError(null);
                    }}
                  >
                    이름 변경
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void execute(() => resumesApi.duplicate(row.id))
                    }
                  >
                    복제
                  </button>
                  <button disabled={busy} onClick={() => setTarget(row)}>
                    삭제
                  </button>
                </CardMenu>
              </article>
            ))}
          </div>
        </>
      )}
      {creating && (
        <Dialog
          title="새 이력서"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          <p>제목과 템플릿을 선택하고 나만의 이력서를 작성하세요.</p>
          <form onSubmit={(event) => void create(event)}>
            <label>
              제목
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              템플릿
              <select
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                disabled={busy}
              >
                <option value="">템플릿 선택</option>
                <option value="classic">classic</option>
                <option value="modern">modern</option>
              </select>
            </label>
            {fieldError && (
              <p role="alert" className="field-error">
                {fieldError}
              </p>
            )}
            <footer>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                취소
              </button>
              <button
                className="primary"
                disabled={busy || !template || !hasText(title)}
              >
                {busy ? "생성 중…" : "생성"}
              </button>
            </footer>
          </form>
        </Dialog>
      )}
      <ConfirmModal
        open={!!target}
        title="이력서 삭제"
        description={`${target?.title ?? ""} 이력서를 삭제합니다. 복구할 수 없습니다.`}
        busy={busy}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target)
            void execute(async () => {
              await resumesApi.remove(target.id);
              setTarget(null);
            });
        }}
      />
    </AppShell>
  );
}
