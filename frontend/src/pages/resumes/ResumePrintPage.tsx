import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { ApiError } from "../../shared/apiClient";
import { resumesApi } from "./api";
import { ResumeRenderer } from "./ResumeRenderer";
import { errorMessage } from "./ResumeSession";
import "./resumes.css";

export function ResumePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const printed = useRef(false);
  const failure = useCallback((cause: unknown) => {
    const message = errorMessage(cause);
    setError(message);
    window.parent.postMessage(
      { type: "resume-print-error", message },
      window.location.origin,
    );
  }, []);
  useEffect(() => {
    let active = true;
    printed.current = false;
    if (!id) return;
    resumesApi
      .get(id)
      .then((response) => {
        if (active) setResume(response.data);
      })
      .catch((cause) => {
        if (!active) return;
        failure(cause);
        if (cause instanceof ApiError && cause.status === 401)
          navigate("/login");
      });
    return () => {
      active = false;
    };
  }, [id, navigate, failure]);
  useEffect(() => {
    const after = () =>
      window.parent.postMessage(
        { type: "resume-afterprint" },
        window.location.origin,
      );
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);
  const ready = useCallback(() => {
    if (!resume || error || printed.current) return;
    const basics = resume.content.find((section) => section.type === "basics");
    document.title =
      basics?.type === "basics"
        ? `${basics.data.name}_${basics.data.jobTitle}_이력서`
        : "이력서";
    printed.current = true;
    window.print();
  }, [resume, error]);
  if (error) return <p role="alert">{error}</p>;
  if (!resume) return <p role="status">인쇄 문서를 불러오는 중…</p>;
  return (
    <div className="resumes-print">
      <ResumeRenderer {...resume} onReady={ready} onError={failure} />
    </div>
  );
}
