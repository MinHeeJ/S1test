import { useCallback, useEffect, useRef, useState } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  Resume,
  ResumeSection,
  SectionType,
} from "../../domain/resume/types";
import { apiClient, ApiRequestError } from "../../shared/apiClient";
import { resumeApi } from "./api";
import { ResumeSaveQueue } from "./autosave";
import type { SaveState } from "./autosave";
import {
  completeness,
  fields,
  missingFields,
  newItem,
  newSection,
  sectionNames,
} from "./resumeFields";
import type { MissingField } from "./resumeFields";
import { ResumeSession } from "./ResumeSession";
import { ResumeDialog, Toast } from "./ResumeFeedback";
import { ResumeInputs } from "./ResumeInputs";
import { ResumePreview } from "./ResumePreview";
import { ResumeSortable } from "./ResumeSortable";
import { ResumeStylePanel } from "./ResumeStylePanel";
import { Icon } from "../../shared/Icon";
import "./resumes.css";

export function ResumeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume>();
  const latest = useRef<Resume>();
  const queue = useRef<ResumeSaveQueue>();
  const [saveState, setSaveState] = useState<SaveState>("저장됨");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<SectionType>>(new Set());
  const previewPanel = useRef<HTMLElement>(null);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState<"input" | "preview">("input");
  const [opened, setOpened] = useState<string>();
  const [removeSection, setRemoveSection] = useState<SectionType>();
  const [missing, setMissing] = useState<MissingField[]>();
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [tagsDraft, setTagsDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState<string>();
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [printing, setPrinting] = useState(false);
  const iframe = useRef<HTMLIFrameElement>();
  const notify = useCallback((value: string) => setMessage(value), []);
  const clear = useCallback(() => setMessage(""), []);
  const handleError = useCallback(
    (value: unknown) => {
      if (value instanceof ApiRequestError && value.status === 401) {
        notify("세션이 만료되었습니다. 다시 로그인해 주세요.");
        navigate("/login");
      }
      return value instanceof ApiRequestError && value.status === 404
        ? "자료를 찾을 수 없습니다."
        : value instanceof Error
          ? value.message
          : "요청을 처리하지 못했습니다.";
    },
    [navigate, notify],
  );
  useEffect(() => {
    let active = true;
    setResume(undefined);
    latest.current = undefined;
    queue.current = undefined;
    setCollapsed(new Set());
    setError("");
    setSettings(false);
    setTab("input");
    if (!id) return;
    void resumeApi
      .get(id)
      .then((result) => {
        if (!active) return;
        if (!result.data)
          throw new Error("이력서 데이터를 가져오지 못했습니다.");
        latest.current = result.data;
        setResume(result.data);
        queue.current = new ResumeSaveQueue(
          result.data,
          setSaveState,
          resumeApi.save,
          resumeApi.rename,
          (value) => notify(handleError(value)),
        );
        setSaveState("저장됨");
      })
      .catch((value) => {
        if (active) setError(handleError(value));
      });
    return () => {
      active = false;
      queue.current?.dispose();
      iframe.current?.remove();
    };
  }, [id, handleError, attempt, notify]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (queue.current && queue.current.state !== "저장됨") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    const printResult = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframe.current?.contentWindow
      )
        return;
      if (event.data === "resume-print-unauthorized") {
        setPrinting(false);
        iframe.current?.remove();
        iframe.current = undefined;
        navigate("/login");
      }
      if (event.data === "resume-print-error") {
        notify("사진 또는 글꼴 준비에 실패하여 인쇄를 중단했습니다.");
        setPrinting(false);
        iframe.current?.remove();
        iframe.current = undefined;
      }
      if (event.data === "resume-print-done") {
        iframe.current?.remove();
        iframe.current = undefined;
        setPrinting(false);
      }
    };
    window.addEventListener("message", printResult);
    return () => window.removeEventListener("message", printResult);
  }, [navigate, notify]);
  const edit = (change: (value: Resume) => void) => {
    if (!latest.current) return;
    const value = structuredClone(latest.current);
    change(value);
    latest.current = value;
    setResume(value);
    queue.current?.change(value);
  };
  const flush = async () => {
    try {
      await queue.current?.flush();
    } catch (value) {
      notify(handleError(value));
      throw value;
    }
  };
  const leave = async () => {
    try {
      await flush();
      navigate("/resumes");
    } catch {
      /* Keep local edits. */
    }
  };
  const focus = (target: string) =>
    requestAnimationFrame(() => document.getElementById(target)?.focus());
  const sectionEdit = (
    type: SectionType,
    change: (section: ResumeSection) => void,
  ) =>
    edit((value) => {
      const section = value.content.find((s) => s.type === type);
      if (section) change(section);
    });
  const upload = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiClient.post<{ photoId: string }>(
        "/api/photos",
        form,
      );
      if (!result.data?.photoId)
        throw new Error("사진 업로드 결과를 확인하지 못했습니다.");
      sectionEdit("basics", (section) => {
        if (section.type === "basics")
          section.data.photoId = result.data!.photoId;
      });
    } catch (value) {
      notify(handleError(value));
    } finally {
      setUploading(false);
    }
  };
  const print = async () => {
    if (!latest.current || printing) return;
    const required = missingFields(latest.current);
    if (required.length) {
      setMissing(required);
      return;
    }
    setPrinting(true);
    try {
      await flush();
      const frame = document.createElement("iframe");
      frame.title = "이력서 인쇄";
      frame.className = "resume-print-frame";
      frame.src = `/print/${encodeURIComponent(latest.current.id)}`;
      iframe.current = frame;
      document.body.append(frame);
    } catch (value) {
      notify(handleError(value));
      setPrinting(false);
    }
  };
  const rename = async () => {
    if (titleDraft === undefined || titleBusy || !resume) return;
    setTitleError("");
    if (!titleDraft.trim()) {
      setTitleError("제목을 입력해 주세요.");
      notify("제목을 입력해 주세요.");
      return;
    }
    setTitleBusy(true);
    const title = titleDraft;
    try {
      await queue.current?.renameTitle(title);
      if (latest.current) latest.current = { ...latest.current, title };
      setResume((value) => (value ? { ...value, title } : value));
      setTitleDraft(undefined);
    } catch (value) {
      if (value instanceof ApiRequestError && value.error.field === "title")
        setTitleError(value.message);
      notify(handleError(value));
    } finally {
      setTitleBusy(false);
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const sectionBody = (section: ResumeSection) => {
    const prefix = section.type;
    if (section.type === "basics" || section.type === "summary") {
      return (
        <>
          <ResumeInputs
            type={section.type}
            values={section.data as Record<string, unknown>}
            prefix={prefix}
            update={(field, value) =>
              sectionEdit(section.type, (target) => {
                if ("data" in target)
                  (target.data as Record<string, unknown>)[field] = value;
              })
            }
          />
          {section.type === "basics" && (
            <>
              <div className="photo-control">
                <button
                  type="button"
                  aria-label={section.data.photoId ? "변경" : "사진 등록"}
                  disabled={uploading}
                  onClick={() => photoInput.current?.click()}
                >
                  {section.data.photoId ? (
                    <>
                      <img
                        src={`/api/photos/${encodeURIComponent(section.data.photoId)}`}
                        alt="등록 사진"
                        onError={() => notify("사진을 불러오지 못했습니다.")}
                      />
                      변경
                    </>
                  ) : (
                    "사진 등록"
                  )}
                </button>
                <p className="meta">
                  JPG·PNG / 2MB 이하 · 파일 선택 후 즉시 등록
                </p>
                <label>
                  사진 등록·변경
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(file);
                    }}
                  />
                </label>
                {uploading && <p role="status">사진 업로드 중…</p>}
                {section.data.photoId && (
                  <button
                    onClick={() =>
                      sectionEdit("basics", (target) => {
                        if (target.type === "basics")
                          target.data.photoId = null;
                      })
                    }
                  >
                    사진 삭제
                  </button>
                )}
              </div>
              {(section.data.links ?? []).map((link, index) => (
                <div className="link-fields" key={index}>
                  {(["label", "url"] as const).map((field) => (
                    <label key={field}>
                      {field === "label" ? "링크 라벨" : "링크 URL"}
                      <input
                        value={link[field] ?? ""}
                        onChange={(event) =>
                          sectionEdit("basics", (target) => {
                            if (target.type === "basics")
                              target.data.links![index][field] =
                                event.target.value;
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    onClick={() =>
                      sectionEdit("basics", (target) => {
                        if (target.type === "basics")
                          target.data.links!.splice(index, 1);
                      })
                    }
                  >
                    링크 삭제
                  </button>
                </div>
              ))}
              <button
                disabled={(section.data.links?.length ?? 0) >= 3}
                onClick={() =>
                  sectionEdit("basics", (target) => {
                    if (target.type === "basics")
                      (target.data.links ??= []).push({ label: "", url: "" });
                  })
                }
              >
                + 링크 추가
              </button>
            </>
          )}
        </>
      );
    }
    if (section.type === "skills") {
      return (
        <>
          <div className="tag-list">
            {(section.data.tags ?? []).map((tag, index) => (
              <span className="tag" key={`${tag}-${index}`}>
                {tag}
                <button
                  aria-label={`${tag} 삭제`}
                  onClick={() =>
                    sectionEdit("skills", (target) => {
                      if (target.type === "skills")
                        target.data.tags!.splice(index, 1);
                    })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <label>
            태그 입력
            <input
              value={tagsDraft}
              onChange={(event) => setTagsDraft(event.target.value)}
              onKeyDown={(event) => {
                if (!["Enter", ","].includes(event.key)) return;
                event.preventDefault();
                const tag = tagsDraft.trim();
                if (
                  !tag ||
                  (section.data.tags?.length ?? 0) >= 30 ||
                  section.data.tags?.includes(tag)
                )
                  return;
                sectionEdit("skills", (target) => {
                  if (target.type === "skills")
                    (target.data.tags ??= []).push(tag);
                });
                setTagsDraft("");
              }}
            />
          </label>
          <p className="meta">Enter·쉼표로 추가 / 최대 30개</p>
        </>
      );
    }
    return (
      <>
        <DndContext
          sensors={sensors}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const ids = section.items.map(
              (item, index) => `${prefix}-${item.id ?? index}`,
            );
            const from = ids.indexOf(String(active.id));
            const to = ids.indexOf(String(over.id));
            if (from < 0 || to < 0) return;
            sectionEdit(section.type, (target) => {
              if ("items" in target)
                target.items = arrayMove(target.items, from, to);
            });
          }}
        >
          <SortableContext
            items={section.items.map(
              (item, index) => `${prefix}-${item.id ?? index}`,
            )}
            strategy={verticalListSortingStrategy}
          >
            {section.items.map((item, index) => {
              const key = `${prefix}-${item.id ?? index}`;
              const values = item as Record<string, unknown>;
              const summary = [
                values[fields[section.type][0]] || "(제목 없음)",
                values.position ?? values.major,
                values.start,
                values.current ? "현재" : values.end,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <ResumeSortable id={key} label={summary} key={key}>
                  <div className="resume-item">
                    <button
                      className="secondary"
                      aria-expanded={opened === key}
                      onClick={() => {
                        setOpened(opened === key ? undefined : key);
                      }}
                    >
                      {summary}
                    </button>
                    <button
                      disabled={section.items.length >= 20}
                      onClick={() => {
                        const copy = {
                          ...structuredClone(item),
                          id: crypto.randomUUID(),
                        };
                        sectionEdit(section.type, (target) => {
                          if ("items" in target)
                            target.items.splice(index + 1, 0, copy);
                        });
                        const copyKey = `${prefix}-${copy.id}`;
                        setOpened(copyKey);
                        focus(`${copyKey}-${fields[section.type][0]}`);
                      }}
                    >
                      항목 복제
                    </button>
                    <button
                      onClick={() => {
                        sectionEdit(section.type, (target) => {
                          if ("items" in target) target.items.splice(index, 1);
                        });
                        if (opened === key) setOpened(undefined);
                        focus(`${prefix}-heading`);
                      }}
                    >
                      항목 삭제
                    </button>
                    {opened === key && (
                      <ResumeInputs
                        type={section.type}
                        values={values}
                        prefix={key}
                        update={(field, value) =>
                          sectionEdit(section.type, (target) => {
                            if ("items" in target)
                              (target.items[index] as Record<string, unknown>)[
                                field
                              ] = value;
                          })
                        }
                      />
                    )}
                  </div>
                </ResumeSortable>
              );
            })}
          </SortableContext>
        </DndContext>
        <button
          disabled={section.items.length >= 20}
          onClick={() => {
            const item = newItem(section.type);
            sectionEdit(section.type, (target) => {
              if ("items" in target) target.items.push(item);
            });
            const key = `${prefix}-${item.id}`;
            setOpened(key);
            focus(`${key}-${fields[section.type][0]}`);
          }}
        >
          + 항목 추가
        </button>
      </>
    );
  };
  if (!resume)
    return (
      <ResumeSession notify={notify}>
        <main className="page-content workspace-state" id="main-content">
          {error ? (
            <section className="workspace-error">
              <Icon name="warning" size={28} />
              <h1>이력서를 열지 못했습니다.</h1>
              <p role="alert">{error}</p>
              <div className="state-actions">
                <button
                  className="primary"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  다시 시도
                </button>
                <button onClick={() => navigate("/resumes")}>
                  목록으로 돌아가기
                </button>
              </div>
            </section>
          ) : (
            <section className="workspace-loading" role="status">
              <p>이력서 불러오는 중…</p>
              <div className="skeleton-paper" aria-hidden="true" />
            </section>
          )}
        </main>
        <Toast message={message} clear={clear} />
      </ResumeSession>
    );
  const completed = completeness(resume);
  const available = (Object.keys(sectionNames) as SectionType[]).filter(
    (type) => !resume.content.some((s) => s.type === type),
  );
  return (
    <ResumeSession notify={notify} beforeExit={flush}>
      <main className="resume-editor" id="main-content">
        <div className="editor-toolbar">
          <button className="secondary" onClick={() => void leave()}>
            <Icon name="arrow" /> ← 목록
          </button>
          {titleDraft === undefined ? (
            <button
              className="title-button secondary"
              onClick={() => {
                setTitleError("");
                setTitleDraft(resume.title);
              }}
            >
              {resume.title}
              <Icon name="edit" size={14} />
            </button>
          ) : (
            <input
              aria-label="이력서 제목"
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? "editor-title-error" : undefined}
              autoFocus
              value={titleDraft}
              disabled={titleBusy}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !titleBusy)
                  setTitleDraft(undefined);
                if (event.key === "Enter") {
                  event.preventDefault();
                  void rename();
                }
              }}
            />
          )}
          {titleDraft !== undefined && (
            <div className="title-actions">
              {titleError && (
                <p
                  id="editor-title-error"
                  className="field-warning"
                  role="alert"
                >
                  {titleError}
                </p>
              )}
              <button disabled={titleBusy} onClick={() => void rename()}>
                제목 저장
              </button>
              <button
                disabled={titleBusy}
                onClick={() => setTitleDraft(undefined)}
              >
                취소
              </button>
            </div>
          )}
          {saveState === "저장 실패·다시 시도" ? (
            <button onClick={() => void flush().catch(() => undefined)}>
              {saveState}
            </button>
          ) : (
            <span className="save-status" data-state={saveState} role="status">
              <span className="save-dot" aria-hidden="true" />
              {saveState}
            </span>
          )}
          <button
            className="secondary style-toggle"
            aria-pressed={settings}
            onClick={() => setSettings((value) => !value)}
          >
            <Icon name="settings" /> 템플릿·스타일
          </button>
          <button
            className="primary"
            disabled={
              printing || uploading || titleBusy || titleDraft !== undefined
            }
            onClick={() => void print()}
          >
            <Icon name="download" />
            {printing ? "인쇄 준비 중…" : "PDF 내보내기"}
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
        <div className={`editor-split tab-${tab}`}>
          <section className="editor-input-panel" aria-label="입력 패널">
            <button
              className="completeness"
              onClick={() => setCriteriaOpen((value) => !value)}
              aria-expanded={criteriaOpen}
            >
              완성도 {completed.score}%
              <span className="completeness-track">
                <span
                  style={{
                    width: `${completed.score}%`,
                    background: completed.color,
                  }}
                />
              </span>
            </button>
            {criteriaOpen && (
              <ul>
                {completed.missing.map((c) => (
                  <li key={c.label}>
                    {c.label} · {c.points}점
                  </li>
                ))}
              </ul>
            )}
            {settings ? (
              <ResumeStylePanel resume={resume} change={edit} />
            ) : (
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
                    if (from < 1 || to < 1) return;
                    edit((value) => {
                      value.content = arrayMove(value.content, from, to);
                    });
                  }}
                >
                  <SortableContext
                    items={resume.content
                      .filter((s) => s.type !== "basics")
                      .map((s) => s.type)}
                    strategy={verticalListSortingStrategy}
                  >
                    {resume.content.map((section) => {
                      const card = (
                        <section
                          className={`section-card ${section.hidden ? "section-hidden" : ""}`}
                        >
                          <div className="section-header">
                            <h2 id={`${section.type}-heading`} tabIndex={-1}>
                              <button
                                className="section-toggle"
                                aria-label={`${sectionNames[section.type]} ${collapsed.has(section.type) ? "펼치기" : "접기"}`}
                                aria-expanded={!collapsed.has(section.type)}
                                aria-controls={`${section.type}-panel`}
                                onClick={() => {
                                  const closing = !collapsed.has(section.type);
                                  setCollapsed((current) => {
                                    const next = new Set(current);
                                    if (closing) next.add(section.type);
                                    else next.delete(section.type);
                                    return next;
                                  });
                                  if (!closing && !section.hidden)
                                    previewPanel.current
                                      ?.querySelector(
                                        `.resume-paper [data-section="${section.type}"]`,
                                      )
                                      ?.scrollIntoView?.({
                                        block: "nearest",
                                        behavior: "smooth",
                                      });
                                }}
                              >
                                {sectionNames[section.type]}
                                <Icon name="chevron" size={16} />
                              </button>
                            </h2>
                            {"items" in section && (
                              <span className="meta">
                                {section.items.length}
                              </span>
                            )}
                            {section.type === "skills" && (
                              <span className="meta">
                                {section.data.tags?.length ?? 0}
                              </span>
                            )}
                            {section.type !== "basics" && (
                              <>
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    sectionEdit(section.type, (target) => {
                                      target.hidden = !target.hidden;
                                    })
                                  }
                                >
                                  <Icon name="eye" size={16} />
                                  {section.hidden ? "다시 표시" : "숨김"}
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => setRemoveSection(section.type)}
                                >
                                  <Icon name="trash" size={16} /> 섹션 삭제
                                </button>
                              </>
                            )}
                          </div>
                          {!collapsed.has(section.type) && (
                            <div
                              className="section-body"
                              id={`${section.type}-panel`}
                            >
                              {"items" in section &&
                                section.items.length === 0 && (
                                  <p className="section-empty">
                                    아직 항목이 없습니다. 경험을 추가해 보세요.
                                  </p>
                                )}
                              {sectionBody(section)}
                            </div>
                          )}
                        </section>
                      );
                      return section.type === "basics" ? (
                        <div key={section.type}>{card}</div>
                      ) : (
                        <ResumeSortable
                          key={section.type}
                          id={section.type}
                          label={sectionNames[section.type]}
                        >
                          {card}
                        </ResumeSortable>
                      );
                    })}
                  </SortableContext>
                </DndContext>
                <label>
                  + 섹션 추가
                  <select
                    disabled={available.length === 0}
                    value=""
                    onChange={(event) => {
                      const type = event.target.value as SectionType;
                      if (available.includes(type))
                        edit((value) => {
                          value.content.push(newSection(type));
                        });
                    }}
                  >
                    <option value="">종류 선택</option>
                    {available.map((type) => (
                      <option key={type} value={type}>
                        {sectionNames[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </section>
          <section
            className="editor-preview-panel"
            aria-label="A4 미리보기"
            ref={previewPanel}
          >
            <div className="preview-heading">
              <span className="eyebrow">LIVE PREVIEW</span>
              <span className="meta">입력한 내용이 바로 반영됩니다.</span>
            </div>
            <ResumePreview key={resume.id} resume={resume} onError={notify} />
          </section>
        </div>
        {removeSection && (
          <ResumeDialog
            title="섹션 삭제 확인"
            cancel={() => setRemoveSection(undefined)}
          >
            <p>{sectionNames[removeSection]} 섹션과 항목을 삭제하시겠습니까?</p>
            <button
              onClick={() => {
                edit((value) => {
                  value.content = value.content.filter(
                    (s) => s.type !== removeSection,
                  );
                });
                setRemoveSection(undefined);
                notify("섹션을 삭제했습니다.");
              }}
            >
              확인
            </button>
          </ResumeDialog>
        )}
        {missing && (
          <ResumeDialog title="빠진 항목" cancel={() => setMissing(undefined)}>
            <ul>
              {missing.map((target, index) => (
                <li key={index}>
                  <button
                    onClick={() => {
                      if (!latest.current) return;
                      const current = missingFields(latest.current);
                      const found = current.find(
                        (m) =>
                          m.section === target.section &&
                          m.item === target.item &&
                          m.field === target.field,
                      );
                      if (!found) {
                        setMissing(current);
                        return;
                      }
                      setSettings(false);
                      setTab("input");
                      setCollapsed((current) => {
                        const next = new Set(current);
                        next.delete(target.section);
                        return next;
                      });
                      const section = latest.current.content.find(
                        (s) => s.type === target.section,
                      )!;
                      let prefix = target.section as string;
                      if ("items" in section && target.item !== undefined) {
                        prefix = `${target.section}-${section.items[target.item].id ?? target.item}`;
                        setOpened(prefix);
                      }
                      setMissing(undefined);
                      focus(`${prefix}-${target.field}`);
                    }}
                  >
                    {target.label}
                  </button>
                </li>
              ))}
            </ul>
          </ResumeDialog>
        )}
        <Toast message={message} clear={clear} />
      </main>
    </ResumeSession>
  );
}
