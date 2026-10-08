import type { ReactNode } from "react";

export function ResumeLoading({ editor = false }: { editor?: boolean }) {
  return (
    <section
      className={`resume-loading ${editor ? "editor-loading" : ""}`}
      aria-busy="true"
    >
      <p className="resume-loading-label" role="status">
        불러오는 중…
      </p>
      <div
        className={editor ? "resume-loading-editor" : "resume-grid"}
        aria-hidden="true"
      >
        {Array.from({ length: editor ? 2 : 4 }, (_, index) => (
          <div className="resume-skeleton" key={index}>
            <div className="skeleton-paper" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResumeNotice({
  title,
  children,
  retry,
  error = false,
}: {
  title: string;
  children?: ReactNode;
  retry?: () => void;
  error?: boolean;
}) {
  return (
    <section
      className={`resume-notice ${error ? "is-error" : ""}`}
      role={error ? "alert" : undefined}
    >
      <div className="notice-symbol" aria-hidden="true">
        {error ? "!" : "+"}
      </div>
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {retry && (
        <button type="button" onClick={retry}>
          다시 시도
        </button>
      )}
    </section>
  );
}
