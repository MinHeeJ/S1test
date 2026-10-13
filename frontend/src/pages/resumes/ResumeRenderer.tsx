import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { Content, ResumeWrite, Section } from "../../shared/contracts";
import { sectionLabels } from "./content";
import { paginate, type MeasuredBlock } from "./pagination";
import "./resumes.css";

interface Block {
  key: string;
  section: string;
  node: ReactNode;
}
const sidebarTypes = new Set(["basics", "skills", "languages", "certificates"]);

function Description({ text }: { text: string }) {
  return (
    <div className="document-description">
      {text.split("\n").map((line, i) =>
        line.startsWith("- ") ? (
          <div key={i} className="document-bullet">
            • {line.slice(2)}
          </div>
        ) : (
          <div key={i}>{line || "\u00a0"}</div>
        ),
      )}
    </div>
  );
}

function sectionBlocks(content: Content): Block[] {
  const result: Block[] = [];
  for (const section of content.filter((s) => !s.hidden)) {
    if (section.type === "basics") {
      const data = section.data;
      result.push({
        key: "basics",
        section: "basics",
        node: (
          <header className="document-basics">
            <div>
              <h1>{data.name}</h1>
              <p>{data.jobTitle}</p>
              <p>
                {data.email} {data.phone}
              </p>
              {data.links.map((link, i) => (
                <p key={i}>
                  {link.label} {link.url}
                </p>
              ))}
            </div>
            {data.photoId && (
              <img
                src={`/api/photos/${encodeURIComponent(data.photoId)}`}
                alt="이력서 사진"
              />
            )}
          </header>
        ),
      });
    } else if (section.type === "summary") {
      result.push({
        key: section.type,
        section: section.type,
        node: (
          <section>
            <h2>{sectionLabels[section.type]}</h2>
            <h3>{section.data.headline}</h3>
            <Description text={section.data.body} />
          </section>
        ),
      });
    } else if (section.type === "skills") {
      result.push({
        key: section.type,
        section: section.type,
        node: (
          <section>
            <h2>{sectionLabels[section.type]}</h2>
            <p>{section.data.tags.join(" · ")}</p>
          </section>
        ),
      });
    } else {
      if (!section.items.length) continue;
      section.items.forEach((item, index) => {
        const value = item as unknown as Record<string, string | boolean>;
        const first =
          section.type === "experience"
            ? "company"
            : section.type === "education"
              ? "school"
              : section.type === "languages"
                ? "language"
                : "name";
        const second =
          section.type === "experience"
            ? "position"
            : section.type === "education"
              ? "major"
              : section.type === "languages"
                ? "test"
                : section.type === "certificates"
                  ? "issuer"
                  : "role";
        result.push({
          key: `${section.type}-${item.id}`,
          section: section.type,
          node: (
            <section>
              {index === 0 && <h2>{sectionLabels[section.type]}</h2>}
              <h3>
                {String(value[first])} {String(value[second])}
              </h3>
              {value.start && (
                <p>
                  {String(value.start)} ~{" "}
                  {value.current ? "현재" : String(value.end)}
                </p>
              )}
              {value.date && <p>{String(value.date)}</p>}
              {value.degree && <p>{String(value.degree)}</p>}
              {value.score && <p>{String(value.score)}</p>}
              {value.url && <p>{String(value.url)}</p>}
              {value.description && (
                <Description text={String(value.description)} />
              )}
            </section>
          ),
        });
      });
    }
  }
  return result;
}

/** Read actual browser line boxes only when an entry cannot fit on an otherwise empty A4 page. */
function measuredLines(element: HTMLElement): string[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lines: { top: number; text: string }[] = [];
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let i = 0; i < (node.textContent?.length ?? 0); i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      const last = lines[lines.length - 1];
      if (!last || Math.abs(last.top - rect.top) > 2)
        lines.push({ top: rect.top, text: "" });
      lines[lines.length - 1].text += node.textContent![i];
    }
  }
  return lines.map((line) => line.text);
}

export interface ResumeRendererProps
  extends Pick<ResumeWrite, "template" | "style" | "content"> {
  firstPageOnly?: boolean;
  onReady?: (pages: number) => void;
}

/** One measured A4 layout is shared by editor, thumbnail and print; hidden sections never enter it. */
export function ResumeRenderer({
  template,
  style,
  content,
  firstPageOnly,
  onReady,
}: ResumeRendererProps) {
  const blocks = useMemo(() => sectionBlocks(content), [content]);
  const measurement = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<{
    left: Block[][];
    right: Block[][];
  } | null>(null);
  const [ready, setReady] = useState(false);
  const modern = template === "modern";
  const left = blocks.filter(
    (block) => modern && sidebarTypes.has(block.section),
  );
  const right = blocks.filter(
    (block) => !modern || !sidebarTypes.has(block.section),
  );
  const styles: CSSProperties = {
    "--document-color": style.color,
    fontFamily:
      style.font === "noto-serif-kr"
        ? '"Noto Serif KR", serif'
        : "Pretendard, sans-serif",
    fontSize: `${style.size === "small" ? 9 : style.size === "large" ? 11 : 10}pt`,
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const calculate = async () => {
      if (document.fonts) await document.fonts.ready;
      if (cancelled || !measurement.current) return;
      const collect = (column: string, values: Block[]) => {
        const nodes = Array.from(
          measurement.current!.querySelectorAll<HTMLElement>(
            `[data-column="${column}"]`,
          ),
        );
        const measured: MeasuredBlock<Block>[] = [];
        values.forEach((block, index) => {
          const element = nodes[index];
          const height = element?.getBoundingClientRect().height ?? 0;
          if (
            height > 1027 &&
            typeof document.createRange().getBoundingClientRect === "function"
          ) {
            const lines = measuredLines(element);
            const lineHeight =
              parseFloat(getComputedStyle(element).lineHeight) || 20;
            const count = Math.max(1, Math.floor(1011 / lineHeight));
            for (let start = 0; start < lines.length; start += count) {
              const chunk = lines.slice(start, start + count);
              measured.push({
                height: chunk.length * lineHeight + 16,
                value: {
                  ...block,
                  key: `${block.key}-${start}`,
                  node: (
                    <div>
                      {chunk.map((text, i) => (
                        <div key={i}>{text}</div>
                      ))}
                    </div>
                  ),
                },
              });
            }
          } else measured.push({ value: block, height });
        });
        return paginate(measured, 1027);
      };
      const next = {
        left: collect("left", left),
        right: collect("right", right),
      };
      setPages(next);
      setReady(true);
    };
    void calculate();
    return () => {
      cancelled = true;
    };
  }, [blocks, template, style.font, style.size, style.color]);

  const count = pages ? Math.max(pages.left.length, pages.right.length) : 1;
  useEffect(() => {
    if (ready) onReady?.(count);
  }, [ready, count, onReady]);
  const renderBlock = (block: Block) => (
    <div
      key={block.key}
      data-section={block.section}
      className="document-block"
    >
      {block.node}
    </div>
  );
  const sheets = pages ?? { left: [left], right: [right] };
  return (
    <div
      className={`resume-renderer ${modern ? "modern" : "classic"}`}
      style={styles}
    >
      <div className="document-measure" ref={measurement} aria-hidden="true">
        <div className="document-left">
          {left.map((block) => (
            <div key={block.key} data-column="left" className="document-block">
              {block.node}
            </div>
          ))}
        </div>
        <div className="document-right">
          {right.map((block) => (
            <div key={block.key} data-column="right" className="document-block">
              {block.node}
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: firstPageOnly ? 1 : count }, (_, index) => (
        <article key={index} className="a4-page">
          {modern && (
            <aside className="document-left">
              {(sheets.left[index] ?? []).map(renderBlock)}
            </aside>
          )}
          <div className="document-right">
            {(sheets.right[index] ?? []).map(renderBlock)}
          </div>
        </article>
      ))}
    </div>
  );
}
