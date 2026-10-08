import { useEffect, useRef, useState } from "react";
import type { Resume } from "../../domain/resume/types";
import { ResumeRenderer } from "./ResumeRenderer";

/** Scale the real first A4 page to the available card width, including mobile columns. */
export function ResumeThumbnail({ resume }: { resume: Resume }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(204);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={container}
      className="resume-thumbnail-content"
      aria-hidden="true"
    >
      <div
        style={{
          width: 794,
          transform: `scale(${width / 794})`,
          transformOrigin: "top left",
        }}
      >
        <ResumeRenderer resume={resume} />
      </div>
    </div>
  );
}
