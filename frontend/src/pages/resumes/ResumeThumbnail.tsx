import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { ResumeRenderer } from "./ResumeRenderer";

/** Scale the same A4 renderer to the actual card width, including two-column mobile grids. */
export function ResumeThumbnail({ resume }: { resume: Resume }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [scale, setScale] = useState(0.257);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / 794),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <Link
      ref={ref}
      className="resume-thumbnail"
      to={`/resumes/${encodeURIComponent(resume.id)}/edit`}
    >
      <div style={{ zoom: scale }}>
        <ResumeRenderer resume={resume} />
      </div>
      <span className="sr-only">{resume.title} 편집</span>
    </Link>
  );
}
