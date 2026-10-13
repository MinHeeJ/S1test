/** Static visual placeholders are chrome, never substitute resume data. */
export function LibraryLoading() {
  return (
    <div
      className="library-loading"
      role="status"
      aria-label="이력서 불러오는 중"
    >
      <p className="page-description">이력서 불러오는 중…</p>
      <div className="resumes-grid library-skeleton" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="resume-card" key={index}>
            <div className="skeleton-paper" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditorLoading() {
  return (
    <div
      className="editor-loading"
      role="status"
      aria-label="이력서 불러오는 중"
    >
      <p>이력서 불러오는 중…</p>
      <div className="editor-loading-layout" aria-hidden="true">
        <div className="loading-fields">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="skeleton-field" key={index} />
          ))}
        </div>
        <div className="skeleton-paper" />
      </div>
    </div>
  );
}
