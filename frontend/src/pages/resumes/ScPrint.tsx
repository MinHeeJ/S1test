import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../shared/api";
import { resumesApi } from "./api";
import type { Resume } from "./model";
import { ResumeRenderer } from "./ResumeRenderer";

/** Reads committed server state. Only an embedded document requests the browser print dialog. */
export function ScPrint() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = useRef(false);
  useEffect(() => {
    let active = true;
    ready.current = false;
    setResume(null);
    setError(null);
    if (!id) return;
    void resumesApi
      .get(id)
      .then((result) => {
        if (active) setResume(result);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "이력서를 찾을 수 없습니다."
            : "인쇄 자료를 불러오지 못했습니다.",
        );
        if (window.parent !== window)
          window.parent.postMessage(
            { type: "resume-print-error", resumeId: id },
            window.location.origin,
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  const onReady = useCallback(() => {
    if (ready.current || !resume) return;
    ready.current = true;
    void (async () => {
      try {
        await document.fonts?.ready;
        await Promise.all(
          [
            ...document.querySelectorAll<HTMLImageElement>(
              ".resume-document img",
            ),
          ].map((image) => {
            if (image.complete)
              return image.naturalWidth > 0
                ? Promise.resolve()
                : Promise.reject(new Error());
            return new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () => reject(new Error());
            });
          }),
        );
        const basics = resume.content[0].data!;
        document.title = `${basics.name}_${basics.jobTitle}_이력서`;
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: "resume-print-ready", resumeId: resume.id },
            window.location.origin,
          );
          requestAnimationFrame(() => window.print());
        }
      } catch {
        setResume(null);
        setError("사진을 불러오지 못했습니다. 인쇄를 중단합니다.");
        if (window.parent !== window)
          window.parent.postMessage(
            { type: "resume-print-error", resumeId: resume.id },
            window.location.origin,
          );
      }
    })();
  }, [resume]);
  if (error)
    return (
      <div>
        <p role="alert">{error}</p>
        <Link to="/resumes">목록으로</Link>
      </div>
    );
  if (!resume) return <p role="status">인쇄 자료를 불러오고 있습니다…</p>;
  return (
    <div className="resume-print">
      {window.parent === window && (
        <p className="print-guide">편집기의 PDF 내보내기를 사용해 주세요.</p>
      )}
      <ResumeRenderer resume={resume} onReady={onReady} />
    </div>
  );
}
