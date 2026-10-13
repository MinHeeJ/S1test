import { useLayoutEffect, useRef, useState } from "react";
import type { Resume } from "../../shared/contracts";
import { ResumeRenderer } from "./ResumeRenderer";

/** Use measured pixels: CSS typed length division is not supported by all target browsers. */
export function ResumeThumbnail({ resume }: { resume: Resume }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / 794);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={viewport} className="thumbnail-viewport" aria-hidden="true">
      <div
        className="thumbnail-document"
        style={{
          transform: `scale(${scale})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <ResumeRenderer
          template={resume.template}
          style={resume.style}
          content={resume.content}
          firstPageOnly
        />
      </div>
    </div>
  );
}
