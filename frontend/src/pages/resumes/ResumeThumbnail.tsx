import { useLayoutEffect, useRef, useState } from "react";
import type { Resume } from "../../domain/resume/types";
import { ResumeRenderer } from "./ResumeRenderer";

/** Keeps the first A4 page aligned with responsive card widths. */
export function ResumeThumbnail({ resume }: { resume: Resume }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(204 / 794);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      if (element.clientWidth > 0) setScale(element.clientWidth / 794);
    };
    resize();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="thumbnail-canvas"
      style={{ "--thumbnail-scale": scale } as React.CSSProperties}
    >
      <ResumeRenderer resume={resume} thumbnail />
    </div>
  );
}
