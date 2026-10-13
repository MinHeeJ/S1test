import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Resume } from "../../shared/contracts";
import { resumesApi } from "./resumesApi";
import { ResumeRenderer } from "./ResumeRenderer";
import "./resumes.css";

export async function waitForImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(
      (image) =>
        new Promise<void>((resolve, reject) => {
          if (image.complete) {
            if (image.naturalWidth > 0) resolve();
            else reject(new Error("사진을 불러오지 못했습니다."));
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error("사진을 불러오지 못했습니다.")),
            { once: true },
          );
        }),
    ),
  );
}

/** Direct tabs never fetch private data. Framed output waits for fonts, pagination and every image. */
export default function PrintPage() {
  const { id } = useParams();
  const framed = window.self !== window.top;
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const cancelled = useRef(false);
  const notifyParent = (type: string) =>
    window.parent.postMessage({ type }, window.location.origin);
  useEffect(() => {
    cancelled.current = false;
    if (!framed || !id) return;
    void resumesApi
      .get(id)
      .then((result) => {
        if (cancelled.current) return;
        if (!result.content?.length)
          throw new Error("인쇄 응답 계약을 확인해 주세요.");
        setResume(result);
      })
      .catch((failure) => {
        if (!cancelled.current) {
          setError(
            failure instanceof Error ? failure.message : "인쇄 조회 실패",
          );
          notifyParent("resume-print-error");
        }
      });
    return () => {
      cancelled.current = true;
    };
  }, [id, framed]);
  const ready = useCallback(async () => {
    if (!root.current || !resume || started.current) return;
    started.current = true;
    try {
      if (document.fonts) await document.fonts.ready;
      await waitForImages(root.current);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (cancelled.current) return;
      const basics = resume.content.find((s) => s.type === "basics");
      if (!basics || basics.type !== "basics")
        throw new Error("기본정보가 없습니다.");
      document.title = `${basics.data.name}_${basics.data.jobTitle}_이력서`;
      window.addEventListener(
        "afterprint",
        () => notifyParent("resume-print-finished"),
        { once: true },
      );
      window.print();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "인쇄 실패");
      notifyParent("resume-print-error");
    }
  }, [resume]);
  if (!framed)
    return <p>인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!resume) return <p role="status">인쇄 자료 불러오는 중…</p>;
  return (
    <div className="print-document" ref={root}>
      <ResumeRenderer
        template={resume.template}
        style={resume.style}
        content={resume.content}
        onReady={() => {
          void ready();
        }}
      />
    </div>
  );
}
