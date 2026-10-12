import { useLayoutEffect, useRef, useState } from "react";
import type { Resume } from "./model";
import { ResumeRenderer } from "./ResumeRenderer";

/** The same first-page renderer scaled to the actual card width, including mobile. */
export function ResumeThumbnail({ resume }: { resume: Resume }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;
    const measure = () => {
      const width = node.getBoundingClientRect().width;
      if (width > 0) setScale(width / 794);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="resume-thumbnail" ref={container}>
      <div className="thumbnail-scale" style={{ zoom: scale ?? undefined }}>
        <ResumeRenderer resume={resume} firstPage />
      </div>
    </div>
  );
}
