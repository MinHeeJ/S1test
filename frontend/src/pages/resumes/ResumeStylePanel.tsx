import type {
  Resume,
  ResumeTemplate,
  StyleFont,
  StyleSize,
} from "../../domain/resume/types";

/** The style panel edits only template/style, preserving the API-backed content. */
export function ResumeStylePanel({
  resume,
  change,
}: {
  resume: Resume;
  change: (resume: Resume) => void;
}) {
  return (
    <section className="resume-style" aria-label="템플릿·스타일">
      <label>
        템플릿
        <select
          value={resume.template}
          onChange={(event) =>
            change({
              ...resume,
              template: event.target.value as ResumeTemplate,
            })
          }
        >
          <option value="classic">Classic</option>
          <option value="modern">Modern</option>
        </select>
      </label>
      <div aria-label="강조색">
        {["#1F3A5F", "#2563EB", "#0F766E", "#9F1239", "#C2410C", "#374151"].map(
          (color) => (
            <button
              key={color}
              style={{ background: color, color: "#fff" }}
              aria-label={color}
              aria-pressed={resume.style.color === color}
              onClick={() =>
                change({ ...resume, style: { ...resume.style, color } })
              }
            >
              ●
            </button>
          ),
        )}
      </div>
      <label>
        글꼴
        <select
          value={resume.style.font}
          onChange={(event) =>
            change({
              ...resume,
              style: {
                ...resume.style,
                font: event.target.value as StyleFont,
              },
            })
          }
        >
          <option value="pretendard">Pretendard</option>
          <option value="noto-serif-kr">Noto Serif KR</option>
        </select>
      </label>
      <label>
        글자 크기
        <select
          value={resume.style.size}
          onChange={(event) =>
            change({
              ...resume,
              style: {
                ...resume.style,
                size: event.target.value as StyleSize,
              },
            })
          }
        >
          {["small", "medium", "large"].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
