import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  ResumeContent,
  ResumeSection,
  ResumeStyle,
  ResumeTemplate,
} from "../../domain/resume/types";
import { sectionLabels } from "./content";
import "./resumes.css";

interface Block {
  key: string;
  type: string;
  node: ReactNode;
}
export interface Fragment {
  index: number;
  offset: number;
  height: number;
}
const PAGE_HEIGHT = 1027;

/** Packs measured unscaled blocks; oversize blocks alone may continue internally onto later sheets. */
export function paginate(
  heights: number[],
  capacity = PAGE_HEIGHT,
): Fragment[][] {
  const pages: Fragment[][] = [[]];
  let used = 0;
  heights.forEach((height, index) => {
    height = Math.max(1, height);
    if (height <= capacity && used + height > capacity) {
      pages.push([]);
      used = 0;
    }
    let offset = 0;
    while (offset < height) {
      if (used === capacity) {
        pages.push([]);
        used = 0;
      }
      const part = Math.min(height - offset, capacity - used);
      pages[pages.length - 1].push({ index, offset, height: part });
      used += part;
      offset += part;
    }
  });
  return pages;
}

function paragraphs(value: string | undefined) {
  return value?.split("\n").map((line, index) =>
    line.startsWith("- ") ? (
      <div key={index} className="resume-bullet">
        • {line.substring(2)}
      </div>
    ) : (
      <div key={index}>{line || "\u00a0"}</div>
    ),
  );
}
function blocks(content: ResumeContent): Block[] {
  const result: Block[] = [];
  for (const section of content.filter((s) => !s.hidden)) {
    const type = section.type;
    if (type === "basics") {
      const data = section.data;
      result.push({
        key: type,
        type,
        node: (
          <header className="resume-basics">
            {data.photoId && (
              <img
                alt="프로필 사진"
                src={`/api/photos/${encodeURIComponent(data.photoId)}`}
              />
            )}
            <div>
              <h1>{data.name}</h1>
              <p>{data.jobTitle}</p>
              <p>{[data.email, data.phone].filter(Boolean).join(" · ")}</p>
              {(data.links ?? []).map((link, i) => (
                <p key={i}>
                  {link.label} {link.url}
                </p>
              ))}
            </div>
          </header>
        ),
      });
    } else if (type === "summary") {
      result.push({
        key: type,
        type,
        node: (
          <section>
            <h2>{sectionLabels[type]}</h2>
            <strong>{section.data.headline}</strong>
            {paragraphs(section.data.body)}
          </section>
        ),
      });
    } else if (type === "skills") {
      result.push({
        key: type,
        type,
        node: (
          <section>
            <h2>{sectionLabels[type]}</h2>
            <p>{(section.data.tags ?? []).join(" · ")}</p>
          </section>
        ),
      });
    } else {
      section.items.forEach((item, index) => {
        const row = item as unknown as Record<string, string | boolean>;
        result.push({
          key: `${type}-${item.id}`,
          type,
          node: (
            <section>
              {index === 0 && <h2>{sectionLabels[type]}</h2>}
              <strong>
                {row.company || row.school || row.name || row.language}
              </strong>
              <p>
                {[
                  row.position,
                  row.major,
                  row.degree,
                  row.role,
                  row.issuer,
                  row.test,
                  row.score,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(row.start || row.end || row.date || row.current) && (
                <p>
                  {row.date ||
                    `${row.start || ""} — ${row.current ? "현재" : row.end || ""}`}
                </p>
              )}
              {paragraphs(row.description as string | undefined)}
              {row.url && <p>{row.url}</p>}
            </section>
          ),
        });
      });
    }
  }
  return result;
}

export interface ResumeRendererProps {
  template: ResumeTemplate;
  style: ResumeStyle;
  content: ResumeContent;
  thumbnail?: boolean;
  onReady?: (pages: number) => void;
  onError?: (error: unknown) => void;
}

/** One measured A4 renderer is shared by editor, first-page thumbnails and server-source print. */
export function ResumeRenderer({
  template,
  style,
  content,
  thumbnail,
  onReady,
  onError,
}: ResumeRendererProps) {
  const measure = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  const error = useRef(onError);
  ready.current = onReady;
  error.current = onError;
  const all = useMemo(() => blocks(content), [content]);
  const columns = useMemo(
    () =>
      template === "modern"
        ? [
            all.filter((b) =>
              ["basics", "skills", "languages", "certificates"].includes(
                b.type,
              ),
            ),
            all.filter(
              (b) =>
                !["basics", "skills", "languages", "certificates"].includes(
                  b.type,
                ),
            ),
          ]
        : [all],
    [all, template],
  );
  const [layout, setLayout] = useState<Fragment[][][]>([[[]]]);
  const [generation, setGeneration] = useState(0);
  const fontSize = { small: 9, medium: 10, large: 11 }[style.size];
  const css = {
    "--resume-color": style.color,
    fontSize: `${fontSize}pt`,
    fontFamily:
      style.font === "noto-serif-kr"
        ? '"Noto Serif KR", serif'
        : "Pretendard, sans-serif",
  } as CSSProperties;

  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    const perform = async () => {
      try {
        if (document.fonts) await document.fonts.ready;
        const images = Array.from(
          measure.current?.querySelectorAll("img") ?? [],
        );
        await Promise.all(
          images.map((image) =>
            image.decode
              ? image.decode()
              : new Promise<void>((resolve, reject) => {
                  if (image.complete) {
                    image.naturalWidth
                      ? resolve()
                      : reject(new Error("사진을 불러오지 못했습니다."));
                  } else {
                    image.onload = () => resolve();
                    image.onerror = () =>
                      reject(new Error("사진을 불러오지 못했습니다."));
                  }
                }),
          ),
        );
        if (!active) return;
        const next = columns.map((_, col) =>
          paginate(
            Array.from(
              measure.current?.children[col]?.children ?? [],
              (node) => (node as HTMLElement).offsetHeight,
            ),
          ),
        );
        setLayout(next);
        setGeneration((value) => value + 1);
      } catch (failure) {
        if (active) error.current?.(failure);
      }
    };
    void perform();
    if (typeof ResizeObserver !== "undefined" && measure.current) {
      observer = new ResizeObserver(() => {
        void perform();
      });
      observer.observe(measure.current);
    }
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [columns, style.font, style.size]);

  const count = Math.max(1, ...layout.map((pages) => pages.length));
  useEffect(() => {
    if (!generation) return;
    const frame = requestAnimationFrame(() => ready.current?.(count));
    return () => cancelAnimationFrame(frame);
  }, [generation, count]);

  const block = (b: Block) => (
    <div className="resume-block" data-section={b.type} key={b.key}>
      {b.node}
    </div>
  );
  return (
    <div className={`resume-renderer ${template}`} style={css}>
      <div ref={measure} className="resume-measure" aria-hidden="true">
        {columns.map((column, i) => (
          <div className={`resume-column column-${i}`} key={i}>
            {column.map(block)}
          </div>
        ))}
      </div>
      {Array.from({ length: thumbnail ? 1 : count }, (_, page) => (
        <article className="resume-paper" key={page}>
          {columns.map((column, col) => (
            <div className={`resume-column column-${col}`} key={col}>
              {(layout[col]?.[page] ?? []).map((fragment, i) => (
                <div
                  key={i}
                  className="resume-fragment"
                  style={{ height: fragment.height }}
                >
                  <div
                    style={{ transform: `translateY(-${fragment.offset}px)` }}
                  >
                    {column[fragment.index] && block(column[fragment.index])}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
