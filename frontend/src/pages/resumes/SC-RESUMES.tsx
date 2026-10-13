import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Resume, Template } from "../../shared/contracts";
import { ConfirmModal } from "../../shared/ConfirmModal";
import { useToastStore } from "../../shared/Toast";
import { ApiRequestError } from "../../shared/apiClient";
import { ResumeThumbnail } from "./ResumeThumbnail";
import { resumesApi } from "./resumesApi";
import { nonblank } from "./content";
import { LibraryLoading } from "./WorkspaceState";
import "./resumes.css";
import "./workspace.css";

export default function ResumesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Resume[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [title, setTitle] = useState("새 이력서");
  const [template, setTemplate] = useState<Template>("classic");
  const [menu, setMenu] = useState<string | null>(null);
  const [rename, setRename] = useState<Resume | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const notify = useToastStore((state) => state.show);
  async function load() {
    try {
      const result = await resumesApi.list();
      if (
        !Array.isArray(result) ||
        result.some((r) => !r.id || typeof r.title !== "string")
      ) {
        throw new Error("목록 응답 계약을 확인해 주세요.");
      }
      setRows(result);
      setError(null);
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "목록 조회 실패";
      setError(message);
      notify(message);
      throw failure;
    }
  }
  useEffect(() => {
    void load().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".card-metadata")
      )
        setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  function removeUnavailable(id: string) {
    setRows((current) => current?.filter((row) => row.id !== id) ?? null);
    setMenu((current) => (current === id ? null : current));
    setRename((current) => (current?.id === id ? null : current));
    setDeleting((current) => (current?.id === id ? null : current));
  }
  async function command(
    id: string,
    action: () => Promise<unknown>,
    after?: () => void,
  ) {
    if (busy) return;
    setBusy(true);
    setFieldError(null);
    try {
      await action();
      after?.();
      notify("처리했습니다.");
      try {
        await load();
      } catch {
        setError(
          "명령은 완료되었으나 목록 갱신 결과를 확인하지 못했습니다. 다시 조회해 주세요.",
        );
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "요청 실패";
      if (failure instanceof ApiRequestError && failure.status === 404)
        removeUnavailable(id);
      if (failure instanceof ApiRequestError && failure.error.field === "title")
        setFieldError(message);
      notify(message);
      throw failure;
    } finally {
      setBusy(false);
    }
  }
  async function submitCreate() {
    if (busy) return;
    if (!nonblank(title)) {
      setFieldError("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const result = await resumesApi.create(title, template);
      if (!result.id)
        throw new Error(
          "생성 결과의 id를 확인하지 못했습니다. 재생성하지 말고 목록을 조회해 주세요.",
        );
      navigate(`/resumes/${encodeURIComponent(result.id)}/edit`);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "생성 실패";
      setFieldError(message);
      notify(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="resumes-library">
      <header className="library-heading">
        <div>
          <p className="eyebrow">내 문서</p>
          <h1>내 이력서</h1>
          <p className="page-description">
            경험을 정리하고, 나만의 이력서를 완성하세요.
          </p>
        </div>
        {rows !== null && (
          <span className="document-count">{rows.length}개의 이력서</span>
        )}
      </header>
      {rows === null && !error && <LibraryLoading />}
      {error && (
        <div className="workspace-error" role="alert">
          {error}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void load().catch(() => undefined);
            }}
          >
            다시 조회
          </button>
        </div>
      )}
      {rows?.length === 0 && (
        <div className="library-empty">
          <span className="empty-mark" aria-hidden="true">
            ＋
          </span>
          <div>
            <h2>첫 이력서를 시작해 보세요</h2>
            <p>아직 이력서가 없습니다. 새 이력서를 만들어 보세요.</p>
          </div>
        </div>
      )}
      {rows !== null && (
        <div className="resumes-grid">
          <button
            type="button"
            className="new-resume"
            aria-label="+ 새 이력서"
            onClick={() => {
              setTitle("새 이력서");
              setTemplate("classic");
              setFieldError(null);
              setCreate(true);
            }}
          >
            <span className="create-mark" aria-hidden="true">
              ＋
            </span>
            <span>새 이력서</span>
            <span className="create-help" aria-hidden="true">
              나의 다음 기회를 위한 한 페이지
            </span>
          </button>
          {rows.map((row) => (
            <article key={row.id} className="resume-card">
              <Link
                className="thumbnail"
                to={`/resumes/${encodeURIComponent(row.id)}/edit`}
                aria-label={`${row.title} 편집`}
              >
                <ResumeThumbnail resume={row} />
              </Link>
              <div className="card-metadata">
                {rename?.id === row.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!nonblank(renameTitle)) {
                        setFieldError("제목을 입력해 주세요.");
                        return;
                      }
                      void command(
                        row.id,
                        () => resumesApi.rename(row.id, renameTitle),
                        () => setRename(null),
                      ).catch(() => undefined);
                    }}
                  >
                    <label>
                      이력서 이름
                      <input
                        value={renameTitle}
                        disabled={busy}
                        onChange={(e) => setRenameTitle(e.target.value)}
                      />
                    </label>
                    {fieldError && <p role="alert">{fieldError}</p>}
                    <button type="submit" disabled={busy}>
                      저장
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRename(null)}
                    >
                      취소
                    </button>
                  </form>
                ) : (
                  <Link to={`/resumes/${encodeURIComponent(row.id)}/edit`}>
                    {row.title}
                  </Link>
                )}
                <time dateTime={row.updated_at} title={row.updated_at}>
                  {new Intl.DateTimeFormat("ko-KR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(row.updated_at))}{" "}
                  수정
                </time>
                <button
                  type="button"
                  aria-label={`${row.title} 메뉴`}
                  aria-expanded={menu === row.id}
                  onClick={() => setMenu(menu === row.id ? null : row.id)}
                >
                  ⋯
                </button>
                {menu === row.id && (
                  <div
                    className="card-menu"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setMenu(null);
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRename(row);
                        setRenameTitle(row.title);
                        setFieldError(null);
                        setMenu(null);
                      }}
                    >
                      이름 변경
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMenu(null);
                        void command(row.id, () =>
                          resumesApi.duplicate(row.id),
                        ).catch(() => undefined);
                      }}
                    >
                      복제
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDeleting(row);
                        setMenu(null);
                      }}
                    >
                      삭제
                    </button>
                    <button type="button" onClick={() => setMenu(null)}>
                      메뉴 닫기
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {create && (
        <div className="modal-overlay">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="새 이력서"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCreate();
            }}
          >
            <h2>새 이력서</h2>
            <label>
              제목
              <input
                value={title}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              템플릿
              <select
                value={template}
                disabled={busy}
                onChange={(e) => setTemplate(e.target.value as Template)}
              >
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
              </select>
            </label>
            {fieldError && <p role="alert">{fieldError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCreate(false)}
              >
                취소
              </button>
              <button
                type="submit"
                className="primary"
                disabled={busy}
                aria-busy={busy}
              >
                생성
              </button>
            </div>
          </form>
        </div>
      )}
      {deleting && (
        <ConfirmModal
          title="이력서 삭제 확인"
          message={`“${deleting.title}” 이력서를 삭제합니다. 복구할 수 없습니다.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            command(
              deleting.id,
              () => resumesApi.delete(deleting.id),
              () => removeUnavailable(deleting.id),
            )
          }
        />
      )}
    </section>
  );
}
