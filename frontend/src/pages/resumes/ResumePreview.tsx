import { useLayoutEffect, useRef, useState } from "react";
import type { Resume } from "../../domain/resume/types";
import { ResumeRenderer } from "./ResumeRenderer";

export function ResumePreview({
  resume,
  thumbnail = false,
  onReady,
  onError,
}: {
  resume: Resume;
  thumbnail?: boolean;
  onReady?: (pages: number) => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [manual, setManual] = useState<number>();
  const [pages, setPages] = useState(1);
  useLayoutEffect(() => {
    const resize = () => {
      if (ref.current?.clientWidth) setFit(ref.current.clientWidth / 794);
    };
    resize();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    if (ref.current) observer?.observe(ref.current);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  const scale = manual ?? fit;
  return (
    <div
      className={thumbnail ? "resume-thumbnail" : "resume-preview"}
      ref={ref}
    >
      {!thumbnail && (
        <div className="preview-controls">
          <label>
            배율
            <input
              type="range"
              aria-label="배율"
              min="50"
              max="150"
              step="1"
              value={
                manual === undefined
                  ? Math.min(150, Math.max(50, fit * 100))
                  : manual * 100
              }
              onChange={(event) => setManual(Number(event.target.value) / 100)}
            />
          </label>
          <span>
            {manual === undefined ? "맞춤" : `${Math.round(scale * 100)}%`}
          </span>
          <button onClick={() => setManual(undefined)}>맞춤</button>
          <span>총 {pages}페이지</span>
        </div>
      )}
      <div
        className="preview-space"
        style={{ height: (thumbnail ? 1123 : pages * 1147) * scale }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: 794,
          }}
        >
          <ResumeRenderer
            resume={resume}
            onReady={(count) => {
              setPages(count);
              onReady?.(count);
            }}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
