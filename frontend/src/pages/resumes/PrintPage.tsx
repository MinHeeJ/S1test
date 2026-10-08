import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { resumesApi } from "./resumesApi";
import { ResumeRenderer } from "./ResumeRenderer";

/** Iframe-only output loads the final server snapshot and waits for fonts, pagination and all photos. */
export function PrintPage() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const printed = useRef(false);
  const ready = useCallback(async () => {
    if (printed.current || !resume) return;
    await document.fonts?.ready;
    try {
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(".resume-paper img"),
        ).map((image) => {
          if (image.complete) {
            if (image.naturalWidth === 0)
              throw new Error("사진을 불러오지 못했습니다.");
            return Promise.resolve();
          }
          return new Promise<void>((resolve, reject) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener(
              "error",
              () => reject(new Error("사진을 불러오지 못했습니다.")),
              { once: true },
            );
          });
        }),
      );
      if (printed.current) return;
      printed.current = true;
      const basics = resume.content.find(
        (section) => section.type === "basics",
      );
      if (basics?.type === "basics")
        document.title = `${basics.data.name}_${basics.data.jobTitle}_이력서`;
      requestAnimationFrame(() => window.print());
    } catch (error) {
      setError(error instanceof Error ? error.message : "인쇄 준비 실패");
    }
  }, [resume]);
  useEffect(() => {
    if (window.parent === window) {
      setError("편집기의 PDF 내보내기를 이용해주세요.");
      return;
    }
    let active = true;
    if (id)
      void resumesApi
        .get(id)
        .then((response) => {
          if (active) setResume(response.data!);
        })
        .catch((error: unknown) => {
          if (active)
            setError(error instanceof Error ? error.message : "조회 실패");
        });
    return () => {
      active = false;
    };
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!resume) return <p role="status">인쇄 준비 중…</p>;
  return (
    <div className="print-document">
      <ResumeRenderer resume={resume} onReady={() => void ready()} />
    </div>
  );
}
export default PrintPage;
