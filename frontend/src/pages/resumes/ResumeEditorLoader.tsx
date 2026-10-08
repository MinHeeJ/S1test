import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  Resume,
  ResumeSection,
  SectionType,
} from "../../domain/resume/types";
import { ApiError } from "../../api/apiClient";
import { Modal } from "../../shared/Modal";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { Toast } from "../../shared/Toast";
import { resumesApi } from "./resumesApi";
import { ResumeSaveQueue } from "./ResumeSaveQueue";
import { ResumeRenderer } from "./ResumeRenderer";
import { ResumeSession } from "./ResumeSession";
import { SectionFields } from "./SectionFields";
import {
  completeness,
  completenessColor,
  emptySection,
  requiredFields,
  sectionLabels,
} from "./resumeRules";

/** Loader never creates fallback content; 404 and session expiry block editing. */
export function ResumeEditorLoader() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResume(undefined);
    setError("");
    if (id)
      void resumesApi
        .get(id)
        .then((response) => {
          if (active) setResume(response.data!);
        })
        .catch((error: unknown) => {
          if (!active) return;
          if (error instanceof ApiError && error.status === 401)
            navigate("/login", { replace: true });
          else
            setError(
              error instanceof Error
                ? error.message
                : "이력서를 불러오지 못했습니다.",
            );
        });
    return () => {
      active = false;
    };
  }, [id, navigate, attempt]);
  if (!resume)
    return (
      <ResumeSession>
        <div className="feedback-panel" role={error ? "alert" : "status"}>
          <h1>
            {error
              ? "이력서를 불러오지 못했습니다."
              : "작업 공간을 준비하고 있습니다."}
          </h1>
          <p>{error || "불러오는 중…"}</p>
          {error ? (
            <div className="state-actions">
              <button onClick={() => setAttempt(attempt + 1)}>다시 시도</button>
              <Link to="/resumes">목록으로 돌아가기</Link>
            </div>
          ) : (
            <div className="editor-skeleton" aria-hidden="true">
              <div />
              <div />
            </div>
          )}
        </div>
      </ResumeSession>
    );
  return <ResumeEditor key={resume.id} initial={resume} />;
}

export function ResumeEditor({ initial }: { initial: Resume }) {
  const [resume, setResume] = useState(initial);
  const latest = useRef(resume);
  latest.current = resume;
  const [toast, setToast] = useState("");
  const [styleOpen, setStyleOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("입력");
  const [zoom, setZoom] = useState(0.6);
  const [criteria, setCriteria] = useState(false);
  const [deleteType, setDeleteType] = useState<SectionType>();
  const [missingOpen, setMissingOpen] = useState(false);
  const [focusPath, setFocusPath] = useState<string>();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(resume.title);
  const [titleError, setTitleError] = useState("");
  const [titleErrorField, setTitleErrorField] = useState<string | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);
  const [iframe, setIframe] = useState<string>();
  const navigate = useNavigate();
  const queue = useMemo(
    () =>
      new ResumeSaveQueue(initial, async (body) => {
        try {
          await resumesApi.update(initial.id, body);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            window.alert(
              "미저장 변경이 반영되지 않았습니다. 다시 로그인하면 마지막 저장본으로 재개합니다.",
            );
            navigate("/login", { replace: true });
          } else
            setToast(
              error instanceof Error ? error.message : "저장에 실패했습니다.",
            );
          throw error;
        }
      }),
    [initial.id, navigate],
  );
  const state = useStore(queue.store, (state) => state.state);
  useEffect(() => {
    queue.activate();
    return () => queue.dispose();
  }, [queue]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (queue.store.getState().state !== "저장됨") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [queue]);
  const change = (next: Resume) => {
    latest.current = next;
    setResume(next);
    queue.change({
      template: next.template,
      style: next.style,
      content: next.content,
    });
  };
  const changeSection = (index: number, section: ResumeSection) =>
    change({
      ...latest.current,
      content: latest.current.content.map((s, i) =>
        i === index ? section : s,
      ),
    });
  const flush = async () => {
    try {
      await queue.flush();
    } catch (error) {
      setToast("저장에 실패했습니다. 현재 화면에 머무릅니다.");
      throw error;
    }
  };
  const exportPdf = async () => {
    if (requiredFields(latest.current.content).length) {
      setFocusPath(undefined);
      setMissingOpen(true);
      return;
    }
    try {
      await flush();
      setIframe(
        `/print/${encodeURIComponent(resume.id)}?request=${Date.now()}`,
      );
    } catch {
      /* The same queue reports failure and blocks iframe creation. */
    }
  };
  const rename = async () => {
    if (titleBusy) return;
    setTitleError("");
    setTitleErrorField(null);
    if (!title.trim()) {
      setTitleError("제목을 입력해주세요.");
      setTitleErrorField("title");
      return;
    }
    setTitleBusy(true);
    try {
      await resumesApi.rename(resume.id, title);
    } catch (error) {
      setTitleBusy(false);
      if (error instanceof ApiError && error.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      const message = error instanceof Error ? error.message : "이름 변경 실패";
      setTitleError(message);
      setTitleErrorField(error instanceof ApiError ? error.field : null);
      setToast(message);
      return;
    }
    setRenaming(false);
    try {
      const response = await resumesApi.get(resume.id);
      // GET confirms only the renamed title; never replace locally edited content or its save queue.
      setResume((current) => ({ ...current, title: response.data!.title }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        navigate("/login", { replace: true });
      else
        setToast(
          `제목은 변경되었지만 결과를 확인하지 못했습니다. ${
            error instanceof Error ? error.message : "조회 실패"
          }`,
        );
    } finally {
      setTitleBusy(false);
    }
  };
  const score = completeness(resume.content);
  const missing = requiredFields(resume.content);
  return (
    <ResumeSession beforeLeave={flush}>
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
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void rename();
            }}
          >
            <input
              aria-label="이력서 제목"
              aria-invalid={titleErrorField === "title"}
              aria-describedby={
                titleErrorField === "title" ? "editor-title-error" : undefined
              }
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {titleError && (
              <span
                id="editor-title-error"
                className="field-warning"
                role="alert"
              >
                {titleError}
              </span>
            )}
            <button disabled={titleBusy} aria-busy={titleBusy}>
              제목 저장
            </button>
            <button
              type="button"
              disabled={titleBusy}
              onClick={() => setRenaming(false)}
            >
              취소
            </button>
          </form>
        ) : (
          <button
            disabled={titleBusy}
            aria-busy={titleBusy}
            onClick={() => {
              setTitle(resume.title);
              setTitleError("");
              setTitleErrorField(null);
              setRenaming(true);
            }}
          >
            {resume.title}
          </button>
        )}
        <button
          disabled={state !== "저장 실패·다시 시도"}
          onClick={() => void flush().catch(() => undefined)}
        >
          {state}
        </button>
        <button
          aria-pressed={styleOpen}
          onClick={() => setStyleOpen(!styleOpen)}
        >
          템플릿·스타일
        </button>
        <button className="primary" onClick={() => void exportPdf()}>
          PDF 내보내기
        </button>
      </div>
      <div className="mobile-editor-tabs">
        {["입력", "미리보기"].map((tab) => (
          <button
            key={tab}
            aria-pressed={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        className={`resume-editor tab-${mobileTab === "입력" ? "input" : "preview"}`}
      >
        <div className="editor-input">
          <button
            className="completeness"
            aria-expanded={criteria}
            onClick={() => setCriteria(!criteria)}
          >
            완성도 {score.score}%
            <span
              style={{
                width: `${score.score}%`,
                background: completenessColor(score.score),
              }}
            />
          </button>
          {criteria && (
            <ul>
              {score.rules
                .filter((rule) => !rule.met)
                .map((rule) => (
                  <li key={rule.label}>{rule.label}</li>
                ))}
            </ul>
          )}
          {styleOpen ? (
            <div className="style-settings fields-grid">
              <h2>템플릿·스타일</h2>
              <label>
                템플릿
                <select
                  value={resume.template}
                  onChange={(event) =>
                    change({
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
                    aria-pressed={color === resume.style.color}
                    style={{ background: color, color: "white" }}
                    onClick={() =>
                      change({ ...resume, style: { ...resume.style, color } })
                    }
                  >
                    {color}
                  </button>
                ))}
              </fieldset>
              <label>
                글꼴
                <select
                  value={resume.style.font}
                  onChange={(event) =>
                    change({
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
                크기
                <select
                  value={resume.style.size}
                  onChange={(event) =>
                    change({
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
            </div>
          ) : (
            <>
              {resume.content.map((section, index) => (
                <section
                  className={`section-card ${section.hidden ? "section-hidden" : ""}`}
                  key={section.type}
                  draggable={section.type !== "basics"}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "text/plain",
                      `section:${index}`,
                    );
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const source = event.dataTransfer.getData("text/plain");
                    if (!source.startsWith("section:") || index === 0) return;
                    const from = Number(source.slice(8));
                    if (from <= 0 || from >= resume.content.length) return;
                    const content = [...resume.content];
                    const [moved] = content.splice(from, 1);
                    content.splice(index, 0, moved);
                    change({ ...resume, content });
                  }}
                >
                  <details
                    open={section.type === "basics"}
                    onToggle={(event) => {
                      if (event.currentTarget.open)
                        document
                          .querySelector(
                            `.editor-preview [data-section="${section.type}"]`,
                          )
                          ?.scrollIntoView?.({ block: "nearest" });
                    }}
                  >
                    <summary>{sectionLabels[section.type]}</summary>
                    {section.type !== "basics" && (
                      <div className="section-controls">
                        <span aria-label="섹션 드래그">↕</span>
                        <button
                          onClick={() =>
                            changeSection(index, {
                              ...section,
                              hidden: !section.hidden,
                            })
                          }
                        >
                          {section.hidden ? "다시 표시" : "숨기기"}
                        </button>
                        <button onClick={() => setDeleteType(section.type)}>
                          섹션 삭제
                        </button>
                      </div>
                    )}
                    <SectionFields
                      section={section}
                      index={index}
                      change={(section) => changeSection(index, section)}
                      onError={setToast}
                      focusPath={focusPath}
                    />
                  </details>
                </section>
              ))}
              <label>
                + 섹션 추가
                <select
                  value=""
                  onChange={(event) => {
                    const type = event.target.value as Exclude<
                      SectionType,
                      "basics"
                    >;
                    if (
                      type &&
                      !resume.content.some((section) => section.type === type)
                    ) {
                      change({
                        ...resume,
                        content: [...resume.content, emptySection(type)],
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
            </>
          )}
        </div>
        <div className="editor-preview">
          <label>
            배율
            <input
              type="range"
              min="50"
              max="150"
              value={zoom * 100}
              onChange={(event) => setZoom(Number(event.target.value) / 100)}
            />
          </label>
          <button
            onClick={() =>
              setZoom(
                Math.min(
                  1.5,
                  Math.max(
                    0.5,
                    (document.querySelector(".editor-preview")!.clientWidth -
                      32) /
                      794,
                  ),
                ),
              )
            }
          >
            맞춤
          </button>
          <div style={{ width: 794 * zoom }}>
            <div style={{ zoom }}>
              <ResumeRenderer resume={resume} />
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(deleteType)}
        title="섹션을 삭제하시겠습니까?"
        onCancel={() => setDeleteType(undefined)}
        onConfirm={() => {
          if (deleteType && deleteType !== "basics")
            change({
              ...resume,
              content: resume.content.filter((s) => s.type !== deleteType),
            });
          setDeleteType(undefined);
        }}
      />
      {missingOpen && (
        <Modal title="필수값 누락" onClose={() => setMissingOpen(false)}>
          <div className="missing-fields">
            <h2>필수값을 입력해주세요.</h2>
            {missing.map((field) => (
              <button
                key={field.path}
                onClick={() => {
                  setMissingOpen(false);
                  setStyleOpen(false);
                  setMobileTab("입력");
                  setFocusPath(field.path);
                }}
              >
                {field.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {iframe && (
        <iframe title="PDF 인쇄" src={iframe} className="print-frame" />
      )}
      {toast && (
        <Toast message={toast} tone="error" onClose={() => setToast("")} />
      )}
    </ResumeSession>
  );
}
export default ResumeEditorLoader;
