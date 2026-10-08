import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Fits the A4 canvas to available width without changing the persisted document. */
export function ResumePreview({
  zoom,
  children,
}: {
  zoom: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      if (element.clientWidth > 0)
        setFit(Math.min(1, element.clientWidth / 794));
    };
    resize();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    observer?.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <div ref={ref} className="resume-preview-viewport">
      <div
        className="resume-preview"
        style={{ zoom: zoom === "fit" ? fit : Number(zoom) / 100 }}
      >
        {children}
      </div>
    </div>
  );
}
