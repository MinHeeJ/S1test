import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type {
  Resume,
  ResumeSection,
  ResumeStyle,
  ResumeTemplate,
  SectionType,
} from "../../domain/resume/types";
import { ApiError } from "../../shared/apiClient";
import { resumesApi } from "./api";
import { ResumeAutosave, type SaveStatus } from "./autosave";
import {
  completeness,
  newSection,
  requiredFields,
  scoreColor,
  sectionLabels,
  type MissingField,
} from "./content";
import { ResumeRenderer } from "./ResumeRenderer";
import { SectionFields, SortableResumeRow } from "./SectionFields";
import {
  clearResumeDraft,
  errorMessage,
  retainResumeDraft,
  restoreResumeDraft,
  ResumeDialog,
  ResumeHeader,
  Toast,
  useToast,
} from "./ResumeSession";
import "./resumes.css";
import { ScreenState } from "../../shared/ScreenState";

export interface ResumeEditorProps {
  photoControl?: (
    photoId: string | null,
    onChange: (photoId: string | null) => void,
  ) => ReactNode;
}
export function ResumeEditorPage({ photoControl }: ResumeEditorProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("저장됨");
  const [settings, setSettings] = useState(false);
  const [details, setDetails] = useState(false);
  const [tab, setTab] = useState("input");
  const [expanded, setExpanded] = useState<string>();
  const [collapsed, setCollapsed] = useState<SectionType[]>([]);
  const [deleteType, setDeleteType] = useState<SectionType>();
  const [missing, setMissing] = useState<MissingField[]>();
  const [title, setTitle] = useState<string>();
  const [titleError, setTitleError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fit, setFit] = useState(0.6);
  const [pages, setPages] = useState(1);
  const queue = useRef<ResumeAutosave>();
  const preview = useRef<HTMLDivElement>(null);
  const { toast, message } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    let active = true;
    setResume(undefined);
    setCollapsed([]);
    setError("");
    if (!id) return;
    resumesApi
      .get(id)
      .then((result) => {
        if (!active) return;
        const draft = restoreResumeDraft(id);
        const value = draft ?? result.data;
        setResume(value);
        queue.current = new ResumeAutosave(value, (state, failure) => {
          if (!active) return;
          setStatus(state);
          if (failure) toast(errorMessage(failure));
        });
        if (draft) queue.current.change(value);
      })
      .catch((failure) => {
        if (active && failure instanceof ApiError && failure.status === 401)
          navigate("/login");
        else if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
      queue.current?.dispose();
      queue.current = undefined;
    };
  }, [id, navigate, toast, attempt]);

  useEffect(() => {
    function expired() {
      if (queue.current && queue.current.status !== "저장됨")
        retainResumeDraft(queue.current.current);
      navigate("/login");
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (queue.current?.status !== "저장됨") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("session-expired", expired);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [navigate]);

  useEffect(() => {
    if (!preview.current) return;
    const update = () =>
      setFit(
        Math.min(1, Math.max(0.1, (preview.current!.clientWidth - 48) / 794)),
      );
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, [resume?.id, tab]);

  function change(value: Resume) {
    setResume(value);
    queue.current?.change(value);
  }
  function sectionChange(section: ResumeSection) {
    const current = queue.current?.current;
    if (current)
      change({
        ...current,
        content: current.content.map((s) =>
          s.type === section.type ? section : s,
        ),
      });
  }
  async function flush() {
    await queue.current?.flush();
    if (queue.current) setResume({ ...queue.current.current });
    clearResumeDraft();
  }
  async function leave() {
    if (busy) return;
    setBusy(true);
    try {
      await flush();
      navigate("/resumes");
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function rename() {
    if (busy || title === undefined) return;
    if (!title.trim()) {
      setTitleError("제목을 입력해 주세요.");
      toast("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setTitleError("");
    try {
      await queue.current?.rename(title.trim());
      if (queue.current) setResume({ ...queue.current.current });
      setTitle(undefined);
    } catch (failure) {
      if (failure instanceof ApiError && failure.body.field === "title")
        setTitleError(failure.message);
      toast(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function exportPdf() {
    if (!resume || busy) return;
    const missing = requiredFields(resume.content);
    if (missing.length) {
      setMissing(missing);
      return;
    }
    setBusy(true);
    try {
      await flush();
      const iframe = document.createElement("iframe");
      iframe.title = "이력서 인쇄";
      iframe.style.cssText =
        "position:fixed;left:-10000px;width:794px;height:1123px;border:0";
      iframe.src = `/print/${encodeURIComponent(resume.id)}`;
      const listener = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          event.source !== iframe.contentWindow
        )
          return;
        if (event.data?.type === "resume-print-error")
          toast(String(event.data.message));
        if (
          ["resume-print-error", "resume-afterprint"].includes(event.data?.type)
        ) {
          iframe.remove();
          window.removeEventListener("message", listener);
          setBusy(false);
        }
      };
      window.addEventListener("message", listener);
      document.body.append(iframe);
    } catch (failure) {
      toast(errorMessage(failure));
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="resumes-page">
        <ResumeHeader />
        <ScreenState
          error
          message={error}
          action={
            <button onClick={() => setAttempt((value) => value + 1)}>
              다시 시도
            </button>
          }
        />
      </div>
    );
  if (!resume) return <ScreenState message="이력서를 불러오는 중…" />;
  const score = completeness(resume.content);
  const scale = zoom === "fit" ? fit : zoom;
  function styleChange(key: keyof ResumeStyle, value: string) {
    const current = queue.current!.current;
    change({ ...current, style: { ...current.style, [key]: value } });
  }
  return (
    <div className="resumes-page">
      <ResumeHeader flush={flush} />
      <div className="resumes-toolbar">
        <button disabled={busy} onClick={() => void leave()}>
          ← 목록
        </button>
        {title === undefined ? (
          <button
            disabled={busy}
            onClick={() => {
              setTitleError("");
              setTitle(resume.title);
            }}
          >
            {resume.title}
          </button>
        ) : (
          <input
            aria-label="이력서 제목"
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? "editor-title-error" : undefined}
            autoFocus
            value={title}
            disabled={busy}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void rename();
              if (event.key === "Escape") setTitle(undefined);
            }}
          />
        )}
        {title !== undefined && titleError && (
          <small
            id="editor-title-error"
            className="resumes-warning"
            role="alert"
          >
            {titleError}
          </small>
        )}
        <button
          disabled={status !== "저장 실패·다시 시도"}
          onClick={() => void flush().catch(() => undefined)}
        >
          {status}
        </button>
        <button aria-pressed={settings} onClick={() => setSettings(!settings)}>
          템플릿·스타일
        </button>
        <button
          disabled={busy}
          aria-busy={busy}
          className="resumes-primary"
          onClick={() => void exportPdf()}
        >
          PDF 내보내기
        </button>
      </div>
      <div className="resumes-tabs" role="tablist" aria-label="편집 보기">
        <button
          role="tab"
          aria-selected={tab === "input"}
          onClick={() => setTab("input")}
        >
          입력
        </button>
        <button
          role="tab"
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </div>
      <div className={`resumes-editor tab-${tab}`}>
        <div className="resumes-input">
          <button
            className="resumes-completeness"
            onClick={() => setDetails(!details)}
          >
            완성도 {score.score}%
            <span
              style={{
                width: `${score.score}%`,
                background: scoreColor(score.score),
              }}
            />
          </button>
          {details && (
            <ul>
              {score.missing.map((rule) => (
                <li key={rule.label}>
                  {rule.label} (+{rule.points}%)
                </li>
              ))}
            </ul>
          )}
          {settings ? (
            <div className="resumes-settings">
              <h2>템플릿·스타일</h2>
              <label>
                템플릿
                <select
                  value={resume.template}
                  onChange={(event) =>
                    change({
                      ...queue.current!.current,
                      template: event.target.value as ResumeTemplate,
                    })
                  }
                >
                  <option value="classic">classic</option>
                  <option value="modern">modern</option>
                </select>
              </label>
              <fieldset>
                <legend>강조색</legend>
                {[
                  "#1F3A5F",
                  "#2563EB",
                  "#0F766E",
                  "#9F1239",
                  "#C2410C",
                  "#374151",
                ].map((color) => (
                  <button
                    key={color}
                    aria-label={color}
                    aria-pressed={resume.style.color === color}
                    style={{ background: color, width: 32, height: 32 }}
                    onClick={() => styleChange("color", color)}
                  />
                ))}
              </fieldset>
              <label>
                글꼴
                <select
                  value={resume.style.font}
                  onChange={(event) => styleChange("font", event.target.value)}
                >
                  <option value="pretendard">Pretendard</option>
                  <option value="noto-serif-kr">Noto Serif KR</option>
                </select>
              </label>
              <label>
                글자 크기
                <select
                  value={resume.style.size}
                  onChange={(event) => styleChange("size", event.target.value)}
                >
                  <option value="small">9pt</option>
                  <option value="medium">10pt</option>
                  <option value="large">11pt</option>
                </select>
              </label>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragEnd={({ active, over }) => {
                if (!over) return;
                const content = queue.current!.current.content;
                const from = content.findIndex((s) => s.type === active.id);
                const to = content.findIndex((s) => s.type === over.id);
                if (from > 0 && to > 0)
                  change({
                    ...queue.current!.current,
                    content: arrayMove(content, from, to),
                  });
              }}
            >
              <SortableContext
                items={resume.content
                  .filter((s) => s.type !== "basics")
                  .map((s) => s.type)}
              >
                {resume.content.map((section) => {
                  const card = (
                    <section
                      className={`resumes-section ${section.hidden ? "hidden-section" : ""}`}
                    >
                      <h2>
                        <button
                          aria-label={sectionLabels[section.type]}
                          aria-expanded={!collapsed.includes(section.type)}
                          aria-controls={`section-fields-${section.type}`}
                          onClick={() => {
                            const opening = collapsed.includes(section.type);
                            setCollapsed((types) =>
                              opening
                                ? types.filter((type) => type !== section.type)
                                : [...types, section.type],
                            );
                            if (opening)
                              preview.current
                                ?.querySelector(
                                  `.resume-paper [data-section="${section.type}"]`,
                                )
                                ?.scrollIntoView?.({
                                  behavior: "smooth",
                                  block: "start",
                                });
                          }}
                        >
                          {sectionLabels[section.type]}{" "}
                          {"items" in section
                            ? `(${section.items.length})`
                            : ""}
                        </button>
                      </h2>
                      {section.type !== "basics" && (
                        <div>
                          <button
                            onClick={() =>
                              sectionChange({
                                ...section,
                                hidden: !section.hidden,
                              })
                            }
                          >
                            {section.hidden ? "다시 표시" : "숨김"}
                          </button>
                          <button onClick={() => setDeleteType(section.type)}>
                            섹션 삭제
                          </button>
                        </div>
                      )}
                      <div
                        id={`section-fields-${section.type}`}
                        hidden={collapsed.includes(section.type)}
                      >
                        <SectionFields
                          section={section}
                          change={sectionChange}
                          expanded={expanded}
                          setExpanded={setExpanded}
                          photoControl={photoControl}
                        />
                      </div>
                    </section>
                  );
                  return section.type === "basics" ? (
                    <div key={section.type}>{card}</div>
                  ) : (
                    <SortableResumeRow key={section.type} id={section.type}>
                      {card}
                    </SortableResumeRow>
                  );
                })}
              </SortableContext>
              <label>
                + 섹션 추가
                <select
                  value=""
                  onChange={(event) => {
                    const type = event.target.value as SectionType;
                    const current = queue.current!.current;
                    if (type && !current.content.some((s) => s.type === type)) {
                      change({
                        ...current,
                        content: [...current.content, newSection(type)],
                      });
                    }
                  }}
                >
                  <option value="">종류 선택</option>
                  {(Object.keys(sectionLabels) as SectionType[])
                    .filter(
                      (type) => !resume.content.some((s) => s.type === type),
                    )
                    .map((type) => (
                      <option value={type} key={type}>
                        {sectionLabels[type]}
                      </option>
                    ))}
                </select>
              </label>
            </DndContext>
          )}
        </div>
        <div className="resumes-preview" ref={preview}>
          <div className="resumes-preview-tools">
            <label>
              줌
              <select
                value={zoom}
                onChange={(event) =>
                  setZoom(
                    event.target.value === "fit"
                      ? "fit"
                      : Number(event.target.value),
                  )
                }
              >
                <option value="fit">맞춤</option>
                <option value="0.5">50%</option>
                <option value="1">100%</option>
                <option value="1.5">150%</option>
              </select>
            </label>
            <span>총 {pages}페이지</span>
          </div>
          <div
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
                {...resume}
                onReady={setPages}
                onError={(failure) => toast(errorMessage(failure))}
              />
            </div>
          </div>
        </div>
      </div>
      {deleteType && (
        <ResumeDialog title="섹션 삭제" close={() => setDeleteType(undefined)}>
          <p>
            {sectionLabels[deleteType]} 섹션과 모든 항목을 삭제하시겠습니까?
          </p>
          <button
            onClick={() => {
              const current = queue.current!.current;
              change({
                ...current,
                content: current.content.filter(
                  (s) => s.type !== deleteType || s.type === "basics",
                ),
              });
              setDeleteType(undefined);
            }}
          >
            삭제 확인
          </button>
        </ResumeDialog>
      )}
      {missing && (
        <ResumeDialog title="빠진 항목" close={() => setMissing(undefined)}>
          {missing.map((field) => (
            <button
              key={field.input}
              onClick={() => {
                setSettings(false);
                setTab("input");
                setExpanded(field.item);
                setCollapsed((types) =>
                  types.filter((type) => {
                    const section = resume.content.find(
                      (entry) => entry.type === type,
                    );
                    return field.item
                      ? !(
                          section &&
                          "items" in section &&
                          section.items.some((item) => item.id === field.item)
                        )
                      : !field.input.startsWith(`${type}-`);
                  }),
                );
                setMissing(undefined);
                requestAnimationFrame(() =>
                  document.getElementById(field.input)?.focus(),
                );
              }}
            >
              {field.label}
            </button>
          ))}
          <p>필수값을 채운 뒤 다시 내보내세요.</p>
        </ResumeDialog>
      )}
      <Toast message={message} />
    </div>
  );
}
