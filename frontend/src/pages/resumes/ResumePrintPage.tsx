import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { resumeApi } from "./resumeApi";
import { ResumeRenderer } from "./ResumeRenderer";

/** Fetches committed server data and prints only after fonts and original photos are ready. */
export function ResumePrintPage() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    if (id)
      resumeApi
        .get(id)
        .then((saved) => {
          if (!active) return;
          setResume(saved);
          const basics = saved.content.find(
            (section) => section.type === "basics",
          );
          document.title = `${basics?.data.name ?? ""}_${basics?.data.jobTitle ?? ""}_이력서`;
        })
        .catch((error) => {
          if (active) {
            setError(error instanceof Error ? error.message : "조회 실패");
            window.parent.postMessage(
              "resume-print-failed",
              window.location.origin,
            );
          }
        });
    return () => {
      active = false;
    };
  }, [id]);
  const ready = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        await document.fonts?.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        // PhotoImage loads private blobs asynchronously; never print its temporary placeholder.
        await new Promise<void>((resolve, reject) => {
          const observer = new MutationObserver(check);
          const timeout = window.setTimeout(
            () => finish(new Error("사진 준비 시간 초과")),
            15000,
          );
          function finish(error?: Error) {
            observer.disconnect();
            window.clearTimeout(timeout);
            if (error) reject(error);
            else resolve();
          }
          function check() {
            const placeholders = Array.from(
              document.querySelectorAll(".resume-paper .photo-placeholder"),
            );
            if (
              placeholders.some(
                (element) => element.getAttribute("role") !== "status",
              )
            ) {
              finish(new Error("사진 조회 실패"));
            } else if (!placeholders.length) finish();
          }
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
          });
          check();
        });
        await Promise.all(
          Array.from(document.querySelectorAll(".resume-paper img")).map(
            async (image) => {
              const img = image as HTMLImageElement;
              if (img.decode) await img.decode();
              else if (!img.complete)
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = reject;
                });
            },
          ),
        );
        window.addEventListener(
          "afterprint",
          () => {
            window.parent.postMessage(
              "resume-print-complete",
              window.location.origin,
            );
          },
          { once: true },
        );
        window.print();
      } catch {
        setError("인쇄 준비에 실패했습니다.");
        window.parent.postMessage(
          "resume-print-failed",
          window.location.origin,
        );
      }
    })();
  }, []);
  return (
    <main className="resume-print-document">
      {error ? (
        <p role="alert">{error}</p>
      ) : resume ? (
        <ResumeRenderer resume={resume} onReady={ready} />
      ) : (
        <p role="status">인쇄 데이터 불러오는 중…</p>
      )}
    </main>
  );
}
