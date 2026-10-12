import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ApiError } from "../../shared/api";
import { logout as logoutSession } from "../auth/authApi";
import { Header } from "../../shared/Header";
import { ConfirmModal } from "../../shared/ConfirmModal";
import { Dialog } from "../../shared/Dialog";
import { useToast } from "../../shared/Toast";
import { useSessionStore } from "../../app/session";
import { resumesApi } from "./api";
import {
  calculateCompleteness,
  colors,
  hasText,
  missingFields,
  newSection,
  pt,
  sectionNames,
  sectionTypes,
  type MissingField,
  type Resume,
  type Section,
  type SectionType,
} from "./model";
import { SaveCoordinator, type SaveState } from "./saveCoordinator";
import { SectionFields } from "./SectionFields";
import { ResumeRenderer } from "./ResumeRenderer";
import "./resumes.css";

function SortableSection({
  section,
  children,
  onDelete,
  onHide,
  onOpen,
}: {
  section: Section;
  children: ReactNode;
  onDelete: () => void;
  onHide: () => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const focus = (event: Event) => {
      if ((event as CustomEvent<string>).detail.startsWith(`${section.type}-`))
        setOpen(true);
    };
    window.addEventListener("resume-focus-field", focus);
    return () => window.removeEventListener("resume-focus-field", focus);
  }, [section.type]);
  const fixed = section.type === "basics";
  const drag = useSortable({ id: section.type, disabled: fixed });
  return (
    <section
      ref={drag.setNodeRef}
      className={`section-card ${section.hidden ? "hidden-section" : ""}`}
      style={{
        transform: drag.transform
          ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`
          : undefined,
        transition: drag.transition,
      }}
    >
      <div className="section-heading">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            if (!open) onOpen();
          }}
        >
          {sectionNames[section.type]}
          {section.items ? ` · ${section.items.length}` : ""}{" "}
          {open ? "접기" : "펼치기"}
        </button>
        {!fixed && (
          <div className="section-actions">
            <button
              aria-label={`${sectionNames[section.type]} 정렬`}
              {...drag.attributes}
              {...drag.listeners}
            >
              ↕
            </button>
            <button onClick={onHide}>{section.hidden ? "표시" : "숨김"}</button>
            <button
              aria-label={`${sectionNames[section.type]} 섹션 삭제`}
              onClick={onDelete}
            >
              삭제
            </button>
          </div>
        )}
      </div>
      {open && children}
    </section>
  );
}

export function ScEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nickname = useSessionStore((state) => state.user?.nickname);
  const [draft, setDraft] = useState<Resume | null>(null);
  const current = useRef<Resume | null>(null);
  const queue = useRef<SaveCoordinator | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("저장됨");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<SectionType | null>(null);
  const [missing, setMissing] = useState<MissingField[] | null>(null);
  const [tab, setTab] = useState("input");
  const [settings, setSettings] = useState(false);
  const [criteria, setCriteria] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);
  const [titleEdit, setTitleEdit] = useState(false);
  const [title, setTitle] = useState("");
  const cancelledTitle = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setDraft(null);
    current.current = null;
    setError(null);
    if (!id) return;
    void resumesApi
      .get(id)
      .then((resume) => {
        if (!active) return;
        current.current = resume;
        setDraft(resume);
        setTitle(resume.title);
        queue.current = new SaveCoordinator(
          resume,
          (value) => resumesApi.save(id, value),
          (value) => resumesApi.rename(id, value),
          (state) => {
            setSaveState(state);
            if (state === "저장 실패·다시 시도")
              useToast
                .getState()
                .show("저장하지 못했습니다. 다시 시도해 주세요.");
          },
        );
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof ApiError && caught.status === 404
              ? "이력서를 찾을 수 없습니다."
              : "이력서를 불러오지 못했습니다. 새로고침해 주세요.",
          );
      });
    return () => {
      active = false;
      queue.current?.dispose();
      queue.current = null;
    };
  }, [id]);
  useEffect(() => {
    if (saveState === "저장됨") return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [saveState]);
  useEffect(() => {
    if (!preview.current) return;
    const measure = () =>
      setFit(
        Math.max(0.1, Math.min(1, (preview.current!.clientWidth - 32) / 794)),
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [draft !== null, tab]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.resumeId !== printId
      )
        return;
      if (
        event.data.type === "resume-print-ready" ||
        event.data.type === "resume-print-error"
      ) {
        setExporting(false);
        if (event.data.type === "resume-print-error") {
          useToast.getState().show("인쇄 자료를 불러오지 못했습니다.");
          setPrintId(null);
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [printId]);

  const change = (value: Resume) => {
    current.current = value;
    setDraft(value);
    queue.current?.change(value);
  };
  const updateSection = (updated: Section) => {
    const latest = current.current;
    if (latest)
      change({
        ...latest,
        content: latest.content.map((section) =>
          section.type === updated.type ? updated : section,
        ),
      });
  };
  const flush = async () => {
    try {
      await queue.current?.flush();
    } catch (caught) {
      useToast.getState().show("저장하지 못했습니다. 편집기에 머무릅니다.");
      throw caught;
    }
  };
  const leave = async () => {
    try {
      await flush();
      navigate("/resumes");
    } catch {
      /* retain current draft */
    }
  };
  const logout = async () => {
    await logoutSession(flush);
  };
  const commitTitle = async () => {
    if (cancelledTitle.current) {
      cancelledTitle.current = false;
      return;
    }
    if (!current.current || !hasText(title)) {
      useToast.getState().show("제목을 입력해 주세요.");
      return;
    }
    if (title === current.current.title) {
      setTitleEdit(false);
      return;
    }
    const next = { ...current.current, title };
    current.current = next;
    setDraft(next);
    setTitleEdit(false);
    try {
      await queue.current?.rename(title);
    } catch {
      /* queue retains retry */
    }
  };
  const exportPdf = async () => {
    if (!current.current || exporting) return;
    const fields = missingFields(current.current.content);
    if (fields.length) {
      setMissing(fields);
      return;
    }
    setExporting(true);
    setPrintId(null);
    try {
      await flush();
      const latestMissing = missingFields(current.current.content);
      if (latestMissing.length) {
        setMissing(latestMissing);
        setExporting(false);
        return;
      }
      setPrintId(current.current.id);
    } catch {
      setExporting(false);
    }
  };
  if (error)
    return (
      <div className="editor-error">
        <p role="alert">{error}</p>
        <Link to="/resumes">목록으로</Link>
      </div>
    );
  if (!draft)
    return (
      <div className="editor-loading">
        <p role="status">이력서를 불러오고 있습니다…</p>
        <div className="editor-skeleton" aria-hidden="true" />
      </div>
    );
  const completion = calculateCompleteness(draft.content);
  return (
    <div className="resume-editor">
      <Header nickname={nickname} onLogout={logout} beforeNavigate={flush} />
      <div className="editor-toolbar">
        <button onClick={() => void leave()}>← 목록</button>
        {titleEdit ? (
          <input
            autoFocus
            aria-label="이력서 제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitTitle();
              }
              if (event.key === "Escape") {
                cancelledTitle.current = true;
                setTitle(draft.title);
                setTitleEdit(false);
              }
            }}
          />
        ) : (
          <button
            className="editor-title"
            onClick={() => {
              cancelledTitle.current = false;
              setTitle(draft.title);
              setTitleEdit(true);
            }}
          >
            {draft.title}
          </button>
        )}
        <button aria-pressed={settings} onClick={() => setSettings(!settings)}>
          템플릿·스타일
        </button>
        <button
          disabled={exporting}
          aria-busy={exporting}
          className="primary"
          onClick={() => void exportPdf()}
        >
          PDF 내보내기
        </button>
        <button
          className="save-status"
          onClick={() => void flush().catch(() => undefined)}
        >
          {saveState}
        </button>
      </div>
      <div className="editor-tabs" role="tablist" aria-label="편집 영역">
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
      <div className={`editor-workspace active-${tab}`}>
        <div className="editor-input">
          <button
            className="completeness"
            onClick={() => setCriteria(!criteria)}
            aria-expanded={criteria}
          >
            완성도 {completion.score}%
            <span
              style={{
                width: `${completion.score}%`,
                background: completion.color,
              }}
            />
          </button>
          {criteria && (
            <div className="completion-popover">
              {completion.unmet.map((criterion) => (
                <p key={criterion}>{criterion}</p>
              ))}
              <button onClick={() => setCriteria(false)}>닫기</button>
            </div>
          )}
          {settings && (
            <section className="section-card style-panel">
              <h2>템플릿·스타일</h2>
              <label>
                템플릿
                <select
                  value={draft.template}
                  onChange={(event) =>
                    change({
                      ...draft,
                      template: event.target.value as Resume["template"],
                    })
                  }
                >
                  <option value="classic">classic</option>
                  <option value="modern">modern</option>
                </select>
              </label>
              <label>
                강조색
                <select
                  value={draft.style.color}
                  onChange={(event) =>
                    change({
                      ...draft,
                      style: { ...draft.style, color: event.target.value },
                    })
                  }
                >
                  {colors.map((color) => (
                    <option key={color}>{color}</option>
                  ))}
                </select>
              </label>
              <label>
                글꼴
                <select
                  value={draft.style.font}
                  onChange={(event) =>
                    change({
                      ...draft,
                      style: {
                        ...draft.style,
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
                  value={draft.style.size}
                  onChange={(event) =>
                    change({
                      ...draft,
                      style: {
                        ...draft.style,
                        size: event.target.value as Resume["style"]["size"],
                      },
                    })
                  }
                >
                  {Object.entries(pt).map(([size, value]) => (
                    <option key={size} value={size}>
                      {value}pt
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
          {!settings && (
            <>
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={({ active, over }) => {
                  if (!over || active.id === "basics" || over.id === "basics")
                    return;
                  const from = draft.content.findIndex(
                    (section) => section.type === active.id,
                  );
                  const to = draft.content.findIndex(
                    (section) => section.type === over.id,
                  );
                  if (from > 0 && to > 0)
                    change({
                      ...draft,
                      content: arrayMove(draft.content, from, to),
                    });
                }}
              >
                <SortableContext
                  items={draft.content.map((section) => section.type)}
                  strategy={verticalListSortingStrategy}
                >
                  {draft.content.map((section) => (
                    <SortableSection
                      key={section.type}
                      section={section}
                      onDelete={() => setTarget(section.type)}
                      onHide={() =>
                        updateSection({ ...section, hidden: !section.hidden })
                      }
                      onOpen={() => {
                        if (!section.hidden)
                          preview.current
                            ?.querySelector(`[data-section="${section.type}"]`)
                            ?.scrollIntoView?.({
                              behavior: "smooth",
                              block: "center",
                            });
                      }}
                    >
                      <SectionFields
                        section={section}
                        onChange={updateSection}
                      />
                    </SortableSection>
                  ))}
                </SortableContext>
              </DndContext>
              <label>
                섹션 추가
                <select
                  value=""
                  onChange={(event) => {
                    const type = event.target.value as SectionType;
                    if (
                      type &&
                      !draft.content.some((section) => section.type === type)
                    ) {
                      change({
                        ...draft,
                        content: [...draft.content, newSection(type)],
                      });
                    }
                  }}
                >
                  <option value="">＋ 섹션 추가</option>
                  {sectionTypes
                    .filter(
                      (type) =>
                        !draft.content.some((section) => section.type === type),
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
        <div className="editor-preview" ref={preview}>
          <div className="preview-controls">
            <label>
              확대
              <input
                type="range"
                min="50"
                max="150"
                value={Math.round((zoom ?? fit) * 100)}
                onChange={(event) => setZoom(Number(event.target.value) / 100)}
              />
            </label>
            <output>{Math.round((zoom ?? fit) * 100)}%</output>
            <button onClick={() => setZoom(null)}>맞춤</button>
          </div>
          <div className="preview-scale" style={{ zoom: zoom ?? fit }}>
            <ResumeRenderer resume={draft} />
          </div>
        </div>
      </div>
      <ConfirmModal
        open={!!target}
        title="섹션 삭제 확인"
        description={`${target ? sectionNames[target] : ""} 섹션과 그 안의 항목을 삭제합니다.`}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target && target !== "basics") {
            change({
              ...draft,
              content: draft.content.filter((s) => s.type !== target),
            });
          }
          setTarget(null);
        }}
      />
      {missing && (
        <Dialog title="빠진 항목" onClose={() => setMissing(null)}>
          <p>내보내기 전에 아래 필수 정보를 입력해 주세요.</p>
          {missing.map((field, index) => (
            <button
              key={`${field.path}-${index}`}
              onClick={() => {
                setMissing(null);
                setTab("input");
                setSettings(false);
                window.dispatchEvent(
                  new CustomEvent("resume-focus-field", {
                    detail: field.path,
                  }),
                );
                requestAnimationFrame(() => {
                  window.dispatchEvent(
                    new CustomEvent("resume-focus-field", {
                      detail: field.path,
                    }),
                  );
                  requestAnimationFrame(() =>
                    document.getElementById(field.path)?.focus(),
                  );
                });
              }}
            >
              {field.label}
            </button>
          ))}
          <button onClick={() => setMissing(null)}>닫기</button>
        </Dialog>
      )}
      {printId && (
        <iframe
          title="이력서 인쇄"
          src={`/print/${encodeURIComponent(printId)}`}
          className="print-frame"
        />
      )}
    </div>
  );
}
