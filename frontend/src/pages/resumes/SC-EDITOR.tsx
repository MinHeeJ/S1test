import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  Resume,
  ResumeWrite,
  Style,
  StyleColor,
  Template,
} from "../../shared/contracts";
import { registerNavigationFlush } from "../../app/navigationGuard";
import { useToastStore } from "../../shared/Toast";
import { ResumeRenderer } from "./ResumeRenderer";
import { SectionPanel } from "./SectionPanel";
import { SaveCoordinator, type SaveState } from "./SaveCoordinator";
import {
  completeness,
  missingFields,
  nonblank,
  type MissingField,
} from "./content";
import { resumesApi } from "./resumesApi";
import { EditorLoading } from "./WorkspaceState";
import "./resumes.css";
import "./workspace.css";

const colors: StyleColor[] = [
  "#1F3A5F",
  "#2563EB",
  "#0F766E",
  "#9F1239",
  "#C2410C",
  "#374151",
];
const snapshot = (r: Resume): ResumeWrite => ({
  title: r.title,
  template: r.template,
  style: r.style,
  content: r.content,
});

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume | null>(null);
  const latest = useRef<Resume | null>(null);
  const coordinator = useRef<SaveCoordinator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const [state, setState] = useState<SaveState>("저장됨");
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState("input");
  const [scoreOpen, setScoreOpen] = useState(false);
  const [missing, setMissing] = useState<MissingField[] | null>(null);
  const [focus, setFocus] = useState<MissingField | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);
  const titlePending = useRef(false);
  const titleCancel = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fit, setFit] = useState(0.7);
  const [pages, setPages] = useState(1);
  const preview = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const notify = useToastStore((s) => s.show);
  const ready = useCallback((count: number) => setPages(count), []);

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | undefined;
    setResume(null);
    latest.current = null;
    setError(null);
    if (!id) {
      setError("이력서를 찾을 수 없습니다.");
      return;
    }
    void resumesApi
      .get(id)
      .then((result) => {
        if (cancelled) return;
        if (
          result.id !== id ||
          typeof result.title !== "string" ||
          !result.content?.length
        ) {
          throw new Error("이력서 응답 계약을 확인해 주세요.");
        }
        latest.current = result;
        setResume(result);
        const queue = new SaveCoordinator(
          snapshot(result),
          (value) => resumesApi.save(id, value),
          async (title) => {
            await resumesApi.rename(id, title);
            if (latest.current) {
              latest.current = { ...latest.current, title };
              setResume(latest.current);
            }
          },
          (value) => {
            setState(value);
            if (value === "저장 실패·다시 시도")
              notify("저장하지 못했습니다. 다시 시도해 주세요.");
          },
        );
        coordinator.current = queue;
        unregister = registerNavigationFlush(() => queue.flush());
      })
      .catch((failure) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : "조회 실패");
      });
    return () => {
      cancelled = true;
      unregister?.();
      coordinator.current?.dispose();
      coordinator.current = null;
      iframe.current?.remove();
      iframe.current = null;
    };
  }, [id, readAttempt]);

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
    if (!preview.current) return;
    const resize = () =>
      setFit(
        Math.min(1.5, Math.max(0.1, (preview.current!.clientWidth - 48) / 794)),
      );
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, [resume !== null]);

  function change(patch: Partial<ResumeWrite>) {
    const current = latest.current;
    if (!current) return;
    const next = { ...current, ...patch };
    latest.current = next;
    setResume(next);
    coordinator.current?.change(snapshot(next));
  }
  async function rename() {
    if (titleCancel.current) {
      titleCancel.current = false;
      return;
    }
    if (titleDraft === null || titlePending.current || !coordinator.current)
      return;
    if (!nonblank(titleDraft)) {
      notify("제목을 입력해 주세요.");
      return;
    }
    const title = titleDraft;
    if (title === latest.current?.title) {
      setTitleDraft(null);
      return;
    }
    titlePending.current = true;
    setTitleBusy(true);
    try {
      await coordinator.current.rename(title);
      if (latest.current) {
        latest.current = { ...latest.current, title };
        setResume(latest.current);
      }
      setTitleDraft(null);
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : "이름 변경 실패");
    } finally {
      titlePending.current = false;
      setTitleBusy(false);
    }
  }
  async function back() {
    try {
      await coordinator.current?.flush();
      navigate("/resumes");
    } catch {
      notify("저장 실패로 목록 이동을 중단했습니다.");
    }
  }
  async function exportPdf() {
    if (!latest.current || !id || exporting) return;
    const fields = missingFields(latest.current.content);
    if (fields.length) {
      setMissing(fields);
      return;
    }
    setExporting(true);
    try {
      await coordinator.current?.flush();
      const frame = document.createElement("iframe");
      frame.title = "이력서 인쇄";
      frame.className = "print-frame";
      frame.src = `/print/${encodeURIComponent(id)}`;
      iframe.current = frame;
      const done = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          event.source !== frame.contentWindow
        )
          return;
        if (
          !["resume-print-error", "resume-print-finished"].includes(
            event.data?.type,
          )
        )
          return;
        if (event.data.type === "resume-print-error")
          notify("인쇄 자료를 불러오지 못했습니다.");
        frame.remove();
        iframe.current = null;
        setExporting(false);
        window.removeEventListener("message", done);
      };
      window.addEventListener("message", done);
      frame.onerror = () => {
        notify("인쇄 화면을 열지 못했습니다.");
        frame.remove();
        iframe.current = null;
        setExporting(false);
        window.removeEventListener("message", done);
      };
      document.body.appendChild(frame);
    } catch {
      notify("저장 실패로 PDF 내보내기를 중단했습니다.");
      setExporting(false);
    }
  }

  if (error)
    return (
      <div className="workspace-error editor-read-error" role="alert">
        <h2>이력서를 불러오지 못했습니다</h2>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setReadAttempt((attempt) => attempt + 1)}
        >
          다시 조회
        </button>
      </div>
    );
  if (!resume) return <EditorLoading />;
  const score = completeness(resume.content);
  const scale = zoom ?? fit;
  return (
    <div className="resume-editor">
      <div className="resume-toolbar">
        <div className="toolbar-identity">
          <button
            type="button"
            onClick={() => {
              void back();
            }}
          >
            ← 목록
          </button>
          {titleDraft !== null ? (
            <input
              aria-label="이력서 제목"
              value={titleDraft}
              autoFocus
              disabled={titleBusy}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                void rename();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void rename();
                }
                if (e.key === "Escape") {
                  titleCancel.current = true;
                  setTitleDraft(null);
                }
              }}
            />
          ) : (
            <button type="button" onClick={() => setTitleDraft(resume.title)}>
              {resume.title}
            </button>
          )}
          <button
            type="button"
            className="save-indicator"
            data-state={state}
            disabled={state !== "저장 실패·다시 시도"}
            onClick={() => {
              void coordinator.current
                ?.flush()
                .catch(() => notify("저장 실패"));
            }}
          >
            {state}
          </button>
        </div>
        <button
          type="button"
          className="mode-switch"
          aria-pressed={settings}
          onClick={() => setSettings(!settings)}
        >
          템플릿·스타일
        </button>
        <button
          type="button"
          className="primary"
          disabled={exporting || titleBusy}
          aria-busy={exporting}
          onClick={() => {
            void exportPdf();
          }}
        >
          PDF 내보내기
        </button>
      </div>
      <div className="editor-workspace" data-tab={tab}>
        <aside className="editor-panel">
          <button
            type="button"
            className="completeness"
            aria-expanded={scoreOpen}
            onClick={() => setScoreOpen(!scoreOpen)}
          >
            완성도 {score.score}%
            <span className="score-track">
              <span
                style={{ width: `${score.score}%`, background: score.color }}
              />
            </span>
          </button>
          {scoreOpen && (
            <ul>
              {score.criteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          )}
          {settings ? (
            <div className="style-panel">
              <h2>템플릿·스타일</h2>
              <p className="panel-description">
                내 경험에 어울리는 문서 스타일을 선택하세요.
              </p>
              <label>
                템플릿
                <select
                  value={resume.template}
                  onChange={(e) =>
                    change({ template: e.target.value as Template })
                  }
                >
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                </select>
              </label>
              <label>
                강조색
                <select
                  value={resume.style.color}
                  onChange={(e) =>
                    change({
                      style: {
                        ...resume.style,
                        color: e.target.value as StyleColor,
                      },
                    })
                  }
                >
                  {colors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                글꼴
                <select
                  value={resume.style.font}
                  onChange={(e) =>
                    change({
                      style: {
                        ...resume.style,
                        font: e.target.value as Style["font"],
                      },
                    })
                  }
                >
                  <option value="pretendard">Pretendard</option>
                  <option value="noto-serif-kr">Noto Serif KR</option>
                </select>
              </label>
              <label>
                글자 크기
                <select
                  value={resume.style.size}
                  onChange={(e) =>
                    change({
                      style: {
                        ...resume.style,
                        size: e.target.value as Style["size"],
                      },
                    })
                  }
                >
                  <option value="small">9pt</option>
                  <option value="medium">10pt</option>
                  <option value="large">11pt</option>
                </select>
              </label>
            </div>
          ) : (
            <SectionPanel
              content={resume.content}
              change={(content) => change({ content })}
              focus={focus}
            />
          )}
        </aside>
        <div className="preview-panel" ref={preview}>
          <div className="preview-controls">
            <label>
              줌
              <input
                type="range"
                min="50"
                max="150"
                value={Math.round(scale * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)}
              />
            </label>
            <span>{Math.round(scale * 100)}%</span>
            <button type="button" onClick={() => setZoom(null)}>
              맞춤
            </button>
            <span>총 {pages}페이지</span>
          </div>
          <div
            className="preview-canvas"
            style={{
              width: 794 * scale,
              height: (1123 * pages + 24 * (pages - 1)) * scale,
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <ResumeRenderer
                template={resume.template}
                style={resume.style}
                content={resume.content}
                onReady={ready}
              />
            </div>
          </div>
        </div>
      </div>
      <nav className="editor-mobile-tabs" aria-label="편집 영역">
        <button
          type="button"
          aria-pressed={tab === "input"}
          onClick={() => setTab("input")}
        >
          입력
        </button>
        <button
          type="button"
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </nav>
      {missing && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="빠진 항목"
          >
            <h2>빠진 항목</h2>
            {missing.map((field) => (
              <button
                key={field.label}
                type="button"
                onClick={() => {
                  setMissing(null);
                  setSettings(false);
                  setTab("input");
                  setFocus({ ...field });
                }}
              >
                {field.label}
              </button>
            ))}
            <button type="button" onClick={() => setMissing(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
