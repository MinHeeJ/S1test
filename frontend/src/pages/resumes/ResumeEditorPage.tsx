import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  Resume,
  ResumeSection,
  SectionType,
} from "../../domain/resume/types";
import { resumeApi, ResumeApiError } from "./resumeApi";
import {
  completeness,
  completenessColor,
  emptySection,
  requiredFields,
  ResumeAutosave,
  sectionNames,
} from "./resumeEditing";
import type { MissingField, SaveStatus } from "./resumeEditing";
import { ResumeStylePanel } from "./ResumeStylePanel";
import { ResumeRenderer } from "./ResumeRenderer";
import { ResumeDialog, ResumeSession, ResumeToast } from "./ResumeSession";
import { ResumeSectionFields, ResumeSortable } from "./ResumeFields";

export function ResumeEditorPage({
  renderPhoto,
}: {
  renderPhoto?: (
    photoId: string | null,
    change: (photoId: string | null) => void,
  ) => ReactNode;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume>();
  const latestResume = useRef(resume);
  latestResume.current = resume;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<SectionType>>(new Set());
  const [focusPath, setFocusPath] = useState<string>();
  const [toast, setToast] = useState("");
  const [status, setStatus] = useState<SaveStatus>("저장됨");
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState("입력");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [pages, setPages] = useState(1);
  const [criteria, setCriteria] = useState(false);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [deleteSection, setDeleteSection] = useState<number>();
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const queue = useRef<ResumeAutosave>();
  const viewport = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.65);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const clear = useCallback(() => setToast(""), []);
  const failure = useCallback(
    (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "요청에 실패했습니다.";
      if (error instanceof ResumeApiError && error.status === 401) {
        window.alert("세션이 만료되었습니다. 미저장 내용은 보관되지 않습니다.");
        navigate("/login");
      }
      setToast(message);
    },
    [navigate],
  );
  useEffect(() => {
    let active = true;
    setResume(undefined);
    setError("");
    if (id)
      resumeApi
        .get(id)
        .then((saved) => {
          if (!active) return;
          setResume(saved);
          queue.current = new ResumeAutosave(
            saved,
            (snapshot) =>
              resumeApi
                .save(snapshot.id, {
                  template: snapshot.template,
                  style: snapshot.style,
                  content: snapshot.content,
                })
                .catch((error) => {
                  failure(error);
                  throw error;
                }),
            setStatus,
          );
        })
        .catch((error) => {
          if (active) {
            setError(
              error instanceof Error ? error.message : "조회에 실패했습니다.",
            );
            failure(error);
          }
        });
    return () => {
      active = false;
      queue.current?.dispose();
    };
  }, [id, failure, attempt]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.current?.status !== "저장됨" && queue.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  useEffect(() => {
    const update = () =>
      setFit(
        Math.min(
          1,
          Math.max(0.2, ((viewport.current?.clientWidth ?? 560) - 40) / 794),
        ),
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [resume, tab]);
  const flush = useCallback(async () => {
    try {
      await queue.current?.flush();
    } catch (error) {
      failure(error);
      throw error;
    }
  }, [failure]);
  function change(next: Resume) {
    setResume(next);
    queue.current?.change(next);
  }
  function sectionChange(index: number, section: ResumeSection) {
    if (resume)
      change({
        ...resume,
        content: resume.content.map((s, i) => (i === index ? section : s)),
      });
  }
  async function print() {
    if (!resume) return;
    const errors = requiredFields(resume.content);
    if (errors.length) {
      setMissing(errors);
      return;
    }
    try {
      await flush();
      const iframe = document.createElement("iframe");
      iframe.title = "이력서 인쇄";
      iframe.className = "resume-print-frame";
      iframe.src = `/print/${encodeURIComponent(resume.id)}`;
      document.body.appendChild(iframe);
      const listener = (event: MessageEvent) => {
        if (
          event.source !== iframe.contentWindow ||
          event.origin !== window.location.origin
        )
          return;
        if (event.data === "resume-print-failed") {
          setToast("인쇄 데이터를 불러오지 못했습니다.");
          cleanup();
        }
        if (event.data === "resume-print-complete") cleanup();
      };
      const cleanup = () => {
        window.removeEventListener("message", listener);
        iframe.remove();
      };
      window.addEventListener("message", listener);
    } catch {
      /* The common save failure already prevents print and displays a toast. */
    }
  }
  async function renameTitle() {
    if (renaming || !resume) return;
    if (!title.trim()) {
      setTitleError("제목을 입력해 주세요.");
      return;
    }
    setRenaming(true);
    setTitleError("");
    let renamed = false;
    try {
      await flush();
      await resumeApi.rename(resume.id, title);
      renamed = true;
      const saved = await resumeApi.get(resume.id);
      // Refresh only title: typing during the request must not be replaced by an older server body.
      setResume((current) => current && { ...current, title: saved.title });
      setRename(false);
      setToast("제목이 변경되었습니다.");
    } catch (error) {
      if (
        !renamed &&
        error instanceof ResumeApiError &&
        error.field === "title"
      )
        setTitleError(error.message);
      failure(error);
      if (renamed)
        setToast("제목은 저장되었지만 변경 결과를 불러오지 못했습니다.");
    } finally {
      setRenaming(false);
    }
  }
  if (!resume)
    return (
      <ResumeSession>
        <div className="resume-page-state">
          {error ? (
            <div className="resume-error-state" role="alert">
              <h1>이력서를 불러오지 못했습니다</h1>
              <p>{error}</p>
              <button onClick={() => setAttempt((value) => value + 1)}>
                다시 시도
              </button>
              <button onClick={() => navigate("/resumes")}>목록으로</button>
            </div>
          ) : (
            <div className="resume-editor-skeleton" role="status">
              <p>작업 공간을 준비하는 중…</p>
              <div className="resume-skeleton" />
            </div>
          )}
        </div>
      </ResumeSession>
    );
  const completion = completeness(resume.content);
  const scale = zoom === "fit" ? fit : zoom / 100;
  return (
    <ResumeSession beforeExit={flush}>
      <div className="resume-editor">
        <div className="resume-toolbar">
          <button
            onClick={() =>
              void flush()
                .then(() => navigate("/resumes"))
                .catch(() => undefined)
            }
          >
            ← 목록
          </button>
          <button
            className="resume-title-button"
            onClick={() => {
              setTitle(resume.title);
              setTitleError("");
              setRename(true);
            }}
          >
            {resume.title}
          </button>
          <button
            className="resume-save-status"
            data-state={status}
            onClick={() => {
              if (status === "저장 실패·다시 시도")
                void flush().catch(() => undefined);
            }}
            aria-live="polite"
          >
            {status}
          </button>
          <button
            aria-pressed={settings}
            onClick={() => {
              setSettings(!settings);
              setTab("입력");
            }}
          >
            템플릿·스타일
          </button>
          <button className="primary" onClick={() => void print()}>
            PDF 내보내기
          </button>
        </div>
        <button
          className="resume-completion"
          style={{ borderColor: completenessColor(completion.score) }}
          aria-expanded={criteria}
          onClick={() => setCriteria(!criteria)}
        >
          <span>완성도 {completion.score}%</span>
          <span className="resume-progress" aria-hidden="true">
            <span
              style={{
                width: `${completion.score}%`,
                background: completenessColor(completion.score),
              }}
            />
          </span>
        </button>
        {criteria && (
          <ul>
            {completion.criteria
              .filter((c) => !c.met)
              .map((c) => (
                <li key={c.label}>
                  {c.label} +{c.points}%
                </li>
              ))}
          </ul>
        )}
        <div className="resume-mobile-tabs">
          {["입력", "미리보기"].map((value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="resume-split" data-tab={tab}>
          <div className="resume-input-panel">
            {settings && <ResumeStylePanel resume={resume} change={change} />}
            {!settings && (
              <>
                <DndContext
                  sensors={sensors}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    const from = resume.content.findIndex(
                      (s) => s.type === active.id,
                    );
                    const to = resume.content.findIndex(
                      (s) => s.type === over.id,
                    );
                    if (from > 0 && to > 0)
                      change({
                        ...resume,
                        content: arrayMove(resume.content, from, to),
                      });
                    else
                      resume.content.forEach((section, index) => {
                        if (!("items" in section)) return;
                        const a = section.items.findIndex(
                          (item) => item.id === active.id,
                        );
                        const b = section.items.findIndex(
                          (item) => item.id === over.id,
                        );
                        if (a >= 0 && b >= 0) {
                          sectionChange(index, {
                            ...section,
                            items: arrayMove<unknown>(section.items, a, b),
                          } as ResumeSection);
                        }
                      });
                  }}
                >
                  <SortableContext
                    items={resume.content.map((s) => s.type)}
                    strategy={verticalListSortingStrategy}
                  >
                    {resume.content.map((section, index) => (
                      <ResumeSortable
                        key={section.type}
                        id={section.type}
                        disabled={section.type === "basics"}
                      >
                        <section
                          className={`resume-section ${section.hidden ? "is-hidden" : ""}`}
                        >
                          <header className="resume-section-header">
                            <h2>
                              <button
                                className="resume-section-toggle"
                                aria-expanded={!collapsed.has(section.type)}
                                aria-label={
                                  sectionNames[section.type] +
                                  (collapsed.has(section.type)
                                    ? " 펼치기"
                                    : " 접기")
                                }
                                onClick={() => {
                                  const opening = collapsed.has(section.type);
                                  setCollapsed((previous) => {
                                    const next = new Set(previous);
                                    if (opening) next.delete(section.type);
                                    else next.add(section.type);
                                    return next;
                                  });
                                  if (opening && !section.hidden) {
                                    viewport.current
                                      ?.querySelector(
                                        `[data-section="${section.type}"]`,
                                      )
                                      ?.scrollIntoView?.({
                                        behavior: "smooth",
                                        block: "nearest",
                                      });
                                  }
                                }}
                              >
                                {sectionNames[section.type]}
                                <span aria-hidden="true">
                                  {collapsed.has(section.type) ? "+" : "−"}
                                </span>
                              </button>
                            </h2>
                            {"items" in section && (
                              <small>{section.items.length}개 항목</small>
                            )}
                          </header>
                          {section.type !== "basics" && (
                            <div className="resume-section-actions">
                              <button
                                onClick={() =>
                                  sectionChange(index, {
                                    ...section,
                                    hidden: !section.hidden,
                                  })
                                }
                              >
                                {section.hidden ? "다시 표시" : "숨김"}
                              </button>
                              <button onClick={() => setDeleteSection(index)}>
                                섹션 삭제
                              </button>
                            </div>
                          )}
                          {!collapsed.has(section.type) && (
                            <>
                              {section.type === "basics" &&
                                renderPhoto?.(
                                  section.data.photoId,
                                  (photoId) => {
                                    // Upload may finish after more typing.
                                    // Apply to the latest snapshot, never the old closure.
                                    const latest = latestResume.current;
                                    if (!latest) return;
                                    change({
                                      ...latest,
                                      content: latest.content.map((current) =>
                                        current.type === "basics"
                                          ? {
                                              ...current,
                                              data: {
                                                ...current.data,
                                                photoId,
                                              },
                                            }
                                          : current,
                                      ),
                                    });
                                  },
                                )}
                              <ResumeSectionFields
                                section={section}
                                index={index}
                                focusPath={focusPath}
                                change={(s) => sectionChange(index, s)}
                                renderItems={(items, ids) => (
                                  <SortableContext
                                    items={ids}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {items}
                                  </SortableContext>
                                )}
                              />
                            </>
                          )}
                        </section>
                      </ResumeSortable>
                    ))}
                  </SortableContext>
                </DndContext>
                <label>
                  섹션 추가
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value)
                        change({
                          ...resume,
                          content: [
                            ...resume.content,
                            emptySection(event.target.value as SectionType),
                          ],
                        });
                    }}
                  >
                    <option value="">종류 선택</option>
                    {(Object.keys(sectionNames) as SectionType[])
                      .filter(
                        (type) => !resume.content.some((s) => s.type === type),
                      )
                      .map((type) => (
                        <option key={type} value={type}>
                          {sectionNames[type]}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="resume-preview-panel" ref={viewport}>
            <div className="resume-preview-controls">
              <label>
                줌
                <select
                  value={zoom}
                  onChange={(e) =>
                    setZoom(
                      e.target.value === "fit" ? "fit" : Number(e.target.value),
                    )
                  }
                >
                  <option value="fit">맞춤</option>
                  {[50, 75, 100, 125, 150].map((n) => (
                    <option key={n} value={n}>
                      {n}%
                    </option>
                  ))}
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
                  width: 794,
                }}
              >
                <ResumeRenderer resume={resume} onPages={setPages} />
              </div>
            </div>
          </div>
        </div>
        {rename && (
          <ResumeDialog
            title="이름 변경"
            close={() => {
              if (!renaming) setRename(false);
            }}
          >
            <label>
              제목
              <input
                value={title}
                disabled={renaming}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? "resume-title-error" : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleError("");
                }}
              />
            </label>
            {titleError && (
              <p id="resume-title-error" role="alert">
                {titleError}
              </p>
            )}
            <button
              disabled={renaming}
              aria-busy={renaming}
              onClick={() => void renameTitle()}
            >
              {renaming ? "처리 중…" : "저장"}
            </button>
          </ResumeDialog>
        )}
        {deleteSection !== undefined && (
          <ResumeDialog
            title="섹션 삭제"
            close={() => setDeleteSection(undefined)}
          >
            <p>
              {sectionNames[resume.content[deleteSection].type]} 섹션과 모든
              항목을 삭제하시겠습니까?
            </p>
            <button
              className="danger"
              onClick={() => {
                change({
                  ...resume,
                  content: resume.content.filter((_, i) => i !== deleteSection),
                });
                setDeleteSection(undefined);
              }}
            >
              삭제 확인
            </button>
          </ResumeDialog>
        )}
        {missing.length > 0 && (
          <ResumeDialog title="빠진 항목" close={() => setMissing([])}>
            {missing.map((field) => (
              <button
                key={field.path}
                onClick={() => {
                  setTab("입력");
                  setSettings(false);
                  setCollapsed(new Set());
                  setFocusPath(field.path);
                  setMissing([]);
                  requestAnimationFrame(() =>
                    document.getElementById(field.path)?.focus(),
                  );
                }}
              >
                {field.label}
              </button>
            ))}
          </ResumeDialog>
        )}
        <ResumeToast message={toast} clear={clear} />
      </div>
    </ResumeSession>
  );
}
