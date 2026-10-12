import type { Resume, ResumeStyle } from "../../domain/resume/types";

const accentColors = [
  "#1F3A5F",
  "#2563EB",
  "#0F766E",
  "#9F1239",
  "#C2410C",
  "#374151",
];

/** Only presentation fields are editable; content and server identity remain untouched. */
export function ResumeStylePanel({
  resume,
  change,
}: {
  resume: Resume;
  change: (update: (value: Resume) => void) => void;
}) {
  return (
    <div className="section-card style-panel">
      <div className="panel-intro">
        <span className="eyebrow">DESIGN</span>
        <h2>템플릿·스타일</h2>
        <p className="meta">내용은 그대로, 나에게 맞는 표현으로.</p>
      </div>
      <label>
        템플릿
        <select
          aria-label="템플릿"
          value={resume.template}
          onChange={(event) =>
            change((value) => {
              value.template = event.target.value as Resume["template"];
            })
          }
        >
          <option value="classic">classic</option>
          <option value="modern">modern</option>
        </select>
      </label>
      <fieldset className="color-options">
        <legend>강조색</legend>
        {accentColors.map((color) => (
          <button
            className="color-swatch"
            key={color}
            aria-label={color}
            title={color}
            aria-pressed={resume.style.color === color}
            style={{ background: color }}
            onClick={() =>
              change((value) => {
                value.style.color = color;
              })
            }
          >
            {resume.style.color === color ? "✓" : "○"}
          </button>
        ))}
      </fieldset>
      <label>
        글꼴
        <select
          aria-label="글꼴"
          value={resume.style.font}
          onChange={(event) =>
            change((value) => {
              value.style.font = event.target.value as ResumeStyle["font"];
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
          aria-label="글자 크기"
          value={resume.style.size}
          onChange={(event) =>
            change((value) => {
              value.style.size = event.target.value as ResumeStyle["size"];
            })
          }
        >
          <option value="small">9pt</option>
          <option value="medium">10pt</option>
          <option value="large">11pt</option>
        </select>
      </label>
    </div>
  );
}
