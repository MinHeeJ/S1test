import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Resume,
  ResumeSection,
  SectionType,
} from "../../domain/resume/types";
import { ResumeAutosave, type ResumeSaveState } from "./ResumeAutosave";
import { resumeApi, resumeInput } from "./resumeApi";
import {
  emptyResumeSection,
  missingResumeFields,
  resumeCompleteness,
  sectionLabels,
} from "./resumeRules";
import {
  ResumeDialog,
  ResumeHeader,
  ResumeToast,
  useResumeFeedback,
} from "./ResumeFeedback";
import { ResumeRenderer } from "./ResumeRenderer";
import { ResumeSectionForm } from "./ResumeSectionForm";
import { ResumeLoading, ResumeNotice } from "./ResumeStates";
import { ResumePreview } from "./ResumePreview";
import "./resumes.css";

function ResumeSectionCard({
  section,
  children,
  toggle,
  remove,
  focus,
}: {
  section: ResumeSection;
  focus: string;
  children: ReactNode;
  toggle: () => void;
  remove: () => void;
}) {
  const sortable = useSortable({
    id: section.type,
    disabled: section.type === "basics",
  });
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (focus.startsWith(`${section.type}-`)) setCollapsed(false);
  }, [focus, section.type]);
  return (
    <article
      ref={sortable.setNodeRef}
      className={`resume-section ${section.hidden ? "is-hidden" : ""}`}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
    >
      <header>
        {section.type !== "basics" && (
          <button
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label="섹션 순서 변경"
          >
            ⠿
          </button>
        )}
        <h2
          aria-label={`${sectionLabels[section.type]}${"items" in section ? ` (${section.items.length})` : ""}`}
        >
          <button
            className="section-toggle"
            aria-expanded={!collapsed}
            aria-label={`${sectionLabels[section.type]} ${collapsed ? "펼치기" : "접기"}`}
            onClick={() => {
              setCollapsed(!collapsed);
              if (collapsed && !section.hidden) {
                document
                  .querySelector(
                    `.resume-preview [data-section="${section.type}"]`,
                  )
                  ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
              }
            }}
          >
            {sectionLabels[section.type]}
            {"items" in section && (
              <span className="section-count">{section.items.length}</span>
            )}
            <span className="section-chevron" aria-hidden="true">
              ⌄
            </span>
          </button>
        </h2>
        {section.type !== "basics" && (
          <>
            <button onClick={toggle}>{section.hidden ? "표시" : "숨김"}</button>
            <button onClick={remove}>섹션 삭제</button>
          </>
        )}
      </header>
      <div hidden={collapsed} className="section-body">
        {children}
      </div>
    </article>
  );
}
function ResumeEditor({ initial }: { initial: Resume }) {
  const [resume, setResume] = useState(initial);
  const [saveState, setSaveState] = useState<ResumeSaveState>("저장됨");
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState<"input" | "preview">("input");
  const [pages, setPages] = useState(1);
  const [zoom, setZoom] = useState("fit");
  const [dialog, setDialog] = useState<
    "missing" | "completeness" | "rename" | "section" | null
  >(null);
  const [removeType, setRemoveType] = useState<SectionType>();
  const [focus, setFocus] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [titleError, setTitleError] = useState("");
  const [print, setPrint] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const feedback = useResumeFeedback();
  const latest = useRef(resume);
  latest.current = resume;
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const queue = useRef<ResumeAutosave>();
  if (!queue.current)
    queue.current = new ResumeAutosave(
      (input) => resumeApi.save(initial.id, input),
      setSaveState,
      (error) => feedbackRef.current.failure(error, true),
    );
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (queue.current!.state !== "저장됨") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      queue.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!focus) return;
    requestAnimationFrame(() => document.getElementById(focus)?.focus());
  }, [focus, dialog, settings]);
  function edit(next: Resume) {
    setResume(next);
    queue.current!.edit(resumeInput(next));
  }
  function sectionChange(type: SectionType, section: ResumeSection) {
    const current = latest.current;
    edit({
      ...current,
      content: current.content.map((row) =>
        row.type === type ? section : row,
      ),
    });
  }
  async function leave(path: string, action?: () => Promise<void>) {
    try {
      await queue.current!.flush();
      await action?.();
      navigate(path);
    } catch (error) {
      feedback.failure(error, true);
    }
  }
  async function exportPdf() {
    if (missingResumeFields(latest.current.content).length) {
      setDialog("missing");
      return;
    }
    try {
      await queue.current!.flush();
      setPrint((count) => count + 1);
    } catch {
      feedback.toast("저장 실패로 인쇄를 중단했습니다.");
    }
  }
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>(
        ".resume-print-frame",
      );
      if (
        event.origin !== window.location.origin ||
        event.source !== frame?.contentWindow
      )
        return;
      if (
        event.data?.type === "resume-print-error" &&
        event.data.id === initial.id
      ) {
        feedbackRef.current.toast(
          "인쇄를 완료하지 못했습니다. 사진 또는 이력서 조회 상태를 확인해 주세요.",
        );
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [initial.id]);
  const completeness = resumeCompleteness(resume.content);
  return (
    <div className="resume-product">
      <ResumeHeader
        leave={(path, action) => {
          void leave(path, action);
        }}
      />
      <nav className="resume-toolbar" aria-label="편집기 툴바">
        <button onClick={() => void leave("/resumes")}>← 목록</button>
        <button
          onClick={() => {
            setTitle(resume.title);
            setTitleError("");
            setDialog("rename");
          }}
        >
          {resume.title}
        </button>
        <button onClick={() => setSettings(!settings)}>
          {settings ? "입력으로 돌아가기" : "템플릿·스타일"}
        </button>
        <button
          onClick={() => void queue.current!.flush().catch(() => undefined)}
        >
          {saveState}
        </button>
        <button className="primary" onClick={() => void exportPdf()}>
          PDF 내보내기
        </button>
      </nav>
      <div className="resume-mobile-tabs">
        <button aria-pressed={tab === "input"} onClick={() => setTab("input")}>
          입력
        </button>
        <button
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          미리보기
        </button>
      </div>
      <main className="resume-editor" data-tab={tab}>
        <div className="resume-input-panel">
          <button
            className="resume-completeness"
            onClick={() => setDialog("completeness")}
          >
            완성도 {completeness.score}%
            <span
              style={{
                width: `${completeness.score}%`,
                background: completeness.color,
              }}
            />
          </button>
          {settings ? (
            <section className="resume-section">
              <h2>템플릿·스타일</h2>
              <label>
                템플릿
                <select
                  value={resume.template}
                  onChange={(event) =>
                    edit({
                      ...resume,
                      template: event.target.value as Resume["template"],
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
                    className="resume-color"
                    style={{ background: color }}
                    onClick={() =>
                      edit({ ...resume, style: { ...resume.style, color } })
                    }
                  />
                ))}
              </fieldset>
              <label>
                글꼴
                <select
                  value={resume.style.font}
                  onChange={(event) =>
                    edit({
                      ...resume,
                      style: {
                        ...resume.style,
                        font: event.target.value as Resume["style"]["font"],
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
                  onChange={(event) =>
                    edit({
                      ...resume,
                      style: {
                        ...resume.style,
                        size: event.target.value as Resume["style"]["size"],
                      },
                    })
                  }
                >
                  <option value="small">9pt</option>
                  <option value="medium">10pt</option>
                  <option value="large">11pt</option>
                </select>
              </label>
            </section>
          ) : (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (
                  !over ||
                  active.id === over.id ||
                  active.id === "basics" ||
                  over.id === "basics"
                )
                  return;
                const from = resume.content.findIndex(
                  (row) => row.type === active.id,
                );
                const to = resume.content.findIndex(
                  (row) => row.type === over.id,
                );
                if (from > 0 && to > 0)
                  edit({
                    ...resume,
                    content: arrayMove(resume.content, from, to),
                  });
              }}
            >
              <SortableContext
                items={resume.content.map((section) => section.type)}
                strategy={verticalListSortingStrategy}
              >
                {resume.content.map((section) => (
                  <ResumeSectionCard
                    key={section.type}
                    section={section}
                    focus={focus}
                    toggle={() =>
                      sectionChange(section.type, {
                        ...section,
                        hidden: !section.hidden,
                      })
                    }
                    remove={() => {
                      setRemoveType(section.type);
                      setDialog("section");
                    }}
                  >
                    <ResumeSectionForm
                      section={section}
                      focus={focus}
                      expandedItem={expandedItem}
                      expandItem={setExpandedItem}
                      change={(next) => sectionChange(section.type, next)}
                      failure={(error) => feedback.failure(error, true)}
                    />
                  </ResumeSectionCard>
                ))}
              </SortableContext>
              <label>
                + 섹션 추가
                <select
                  value=""
                  onChange={(event) => {
                    const type = event.target.value as SectionType;
                    if (type && !resume.content.some((s) => s.type === type)) {
                      edit({
                        ...resume,
                        content: [...resume.content, emptyResumeSection(type)],
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
                      <option key={type} value={type}>
                        {sectionLabels[type]}
                      </option>
                    ))}
                </select>
              </label>
            </DndContext>
          )}
        </div>
        <div className="resume-preview-panel">
          <div className="resume-preview-controls">
            <label>
              배율
              <select
                value={zoom}
                onChange={(event) => setZoom(event.target.value)}
              >
                <option value="fit">맞춤</option>
                {[50, 75, 100, 125, 150].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
            <span>총 {pages}페이지</span>
          </div>
          <ResumePreview zoom={zoom}>
            <ResumeRenderer resume={resume} onPages={setPages} />
          </ResumePreview>
        </div>
      </main>
      {dialog && (
        <ResumeDialog
          title={
            dialog === "missing"
              ? "필수 항목을 입력해 주세요"
              : dialog === "completeness"
                ? "완성도 기준"
                : dialog === "section"
                  ? "섹션 삭제"
                  : "이름 변경"
          }
          close={() => {
            if (!busy) setDialog(null);
          }}
        >
          {dialog === "missing" &&
            missingResumeFields(resume.content).map((field) => (
              <button
                key={field.target}
                onClick={() => {
                  setDialog(null);
                  setSettings(false);
                  setTab("input");
                  const [type, index] = field.target.split("-");
                  const section = resume.content.find(
                    (entry) => entry.type === type,
                  );
                  if (section && "items" in section) {
                    const item = section.items[Number(index)];
                    if (item) setExpandedItem(`${type}:${item.id}`);
                  }
                  setFocus("");
                  requestAnimationFrame(() => setFocus(field.target));
                }}
              >
                {field.label}
              </button>
            ))}
          {dialog === "completeness" &&
            completeness.criteria
              .filter((criterion) => !criterion.met)
              .map((criterion) => (
                <p key={criterion.label}>
                  ○ {criterion.label} +{criterion.score}%
                </p>
              ))}
          {dialog === "section" && (
            <>
              <p>
                {removeType && sectionLabels[removeType]} 섹션과 항목을
                삭제할까요?
              </p>
              <button onClick={() => setDialog(null)}>취소</button>
              <button
                onClick={() => {
                  edit({
                    ...resume,
                    content: resume.content.filter(
                      (s) => s.type !== removeType,
                    ),
                  });
                  setDialog(null);
                }}
              >
                삭제 확인
              </button>
            </>
          )}
          {dialog === "rename" && (
            <>
              <label>
                제목
                <input
                  value={title}
                  disabled={busy}
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={
                    titleError ? "editor-title-error" : undefined
                  }
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setTitleError("");
                  }}
                />
              </label>
              {titleError && (
                <p id="editor-title-error" role="alert">
                  {titleError}
                </p>
              )}
              <button disabled={busy} onClick={() => setDialog(null)}>
                취소
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (!title.trim()) {
                    setTitleError("제목을 입력해 주세요.");
                    return;
                  }
                  setBusy(true);
                  void queue
                    .current!.flush()
                    .then(() => resumeApi.rename(resume.id, title.trim()))
                    .then(async () => {
                      setResume((current) => ({
                        ...current,
                        title: title.trim(),
                      }));
                      setDialog(null);
                      try {
                        const saved = await resumeApi.get(resume.id);
                        setResume((current) => ({
                          ...current,
                          title: saved.title,
                        }));
                        feedback.toast("이름을 변경했습니다.");
                      } catch (error) {
                        feedback.failure(error, true);
                        feedback.toast(
                          "이름은 변경되었지만 결과 조회에 실패했습니다. 다시 조회해 주세요.",
                        );
                      }
                    })
                    .catch((error) => {
                      feedback.failure(error, true);
                      setTitleError(
                        error instanceof Error
                          ? error.message
                          : "이름을 변경하지 못했습니다.",
                      );
                    })
                    .finally(() => setBusy(false));
                }}
              >
                저장
              </button>
            </>
          )}
          {(dialog === "completeness" || dialog === "missing") && (
            <button onClick={() => setDialog(null)}>닫기</button>
          )}
        </ResumeDialog>
      )}
      {print > 0 && (
        <iframe
          key={print}
          title="이력서 PDF 인쇄"
          src={`/print/${encodeURIComponent(resume.id)}`}
          className="resume-print-frame"
        />
      )}
      <ResumeToast message={feedback.message} />
    </div>
  );
}
export function ResumeEditorPage() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const feedback = useResumeFeedback();
  async function load() {
    setResume(undefined);
    setError("");
    try {
      if (id) setResume(await resumeApi.get(id));
    } catch (cause) {
      setError("이력서를 불러오지 못했습니다.");
      feedback.failure(cause);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  if (error)
    return (
      <main className="resume-product resume-load-page">
        <ResumeNotice title={error} error retry={() => void load()}>
          이력서가 없거나 접근할 수 없습니다. 조회에 실패한 내용을 새 문서로
          대체하지 않습니다.
        </ResumeNotice>
      </main>
    );
  return resume ? (
    <ResumeEditor key={resume.id} initial={resume} />
  ) : (
    <main className="resume-product resume-load-page">
      <ResumeLoading editor />
    </main>
  );
}
