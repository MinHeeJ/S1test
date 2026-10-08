import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { resumeApi } from "./resumeApi";
import { ResumeRenderer } from "./ResumeRenderer";
import { useResumeFeedback } from "./ResumeFeedback";
import "./resumes.css";

/** Fetches committed server state, then prints only after fonts, images and A4 layout are ready. */
export function PrintPage() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const { failure } = useResumeFeedback();
  function printError(message: string) {
    setError(message);
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "resume-print-error", id, message },
        window.location.origin,
      );
    }
  }
  useEffect(() => {
    if (!id) return;
    resumeApi
      .get(id)
      .then((value) => {
        setResume(value);
        const basics = value.content.find(
          (section) => section.type === "basics",
        );
        if (basics?.type === "basics")
          document.title = `${basics.data.name}_${basics.data.jobTitle}_이력서`;
      })
      .catch((cause) => {
        printError("이력서를 불러오지 못했습니다. 인쇄를 중단했습니다.");
        failure(cause);
      });
  }, [id]);
  return (
    <main className="resume-print">
      {error && <p role="alert">{error}</p>}
      {!resume && !error && <p role="status">인쇄 준비 중…</p>}
      {resume && (
        <ResumeRenderer
          resume={resume}
          onError={printError}
          onReady={() => {
            if (window.parent !== window)
              requestAnimationFrame(() => window.print());
          }}
        />
      )}
    </main>
  );
}
