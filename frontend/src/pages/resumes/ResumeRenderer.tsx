import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Resume, ResumeSection } from "../../domain/resume/types";
import { sectionLabels } from "./resumeRules";
import "./resumes.css";

type Block = {
  key: string;
  type: string;
  text?: string;
  section?: ResumeSection;
  heading?: string;
};
const leftTypes = new Set(["basics", "skills", "languages", "certificates"]);
export const safeLink = (url: string) =>
  /^https?:\/\//i.test(url) ? url : undefined;
function blocks(sections: ResumeSection[]): Block[] {
  return sections
    .filter((section) => !section.hidden)
    .flatMap<Block>((section) => {
      if (section.type === "basics")
        return [{ key: "basics", type: "basics", section }];
      if ("items" in section) {
        return section.items.map((item, index) => {
          const fields = item as unknown as Record<string, unknown>;
          const text = Object.entries(fields)
            .filter(([key]) => !["id", "current", "end"].includes(key))
            .map(([key, value]) =>
              key === "start"
                ? [value, fields.current ? "현재" : fields.end]
                    .filter(Boolean)
                    .join(" — ")
                : value,
            )
            .filter((value) => typeof value === "string" && value.length > 0)
            .join("\n");
          return {
            key: `${section.type}-${item.id}`,
            type: section.type,
            text,
            heading: index === 0 ? sectionLabels[section.type] : undefined,
          };
        });
      }
      return [
        {
          key: section.type,
          type: section.type,
          heading: sectionLabels[section.type],
          text:
            section.type === "summary"
              ? [section.data.headline, section.data.body]
                  .filter(Boolean)
                  .join("\n")
              : (section.data.tags ?? []).join(" · "),
        },
      ];
    });
}
function PaperBlock({ block }: { block: Block }) {
  if (block.section?.type === "basics") {
    const data = block.section.data;
    return (
      <section data-section="basics" className="paper-basics">
        {data.photoId && (
          <img
            src={`/api/photos/${encodeURIComponent(data.photoId)}`}
            alt="프로필 사진"
          />
        )}
        <h1>{data.name}</h1>
        <h2>{data.jobTitle}</h2>
        <p>{data.email}</p>
        <p>{data.phone}</p>
        {(data.links ?? []).map((link, index) => (
          <p key={index}>
            {safeLink(link.url) ? (
              <a href={link.url} rel="noreferrer">
                {link.label || link.url}
              </a>
            ) : (
              <span>
                {link.label} {link.url}
              </span>
            )}
          </p>
        ))}
      </section>
    );
  }
  return (
    <section data-section={block.type} className="paper-block">
      {block.heading && <h2>{block.heading}</h2>}
      <p>{block.text}</p>
    </section>
  );
}
/** A4 renderer shared by preview, thumbnails and print. Heights are measured at the real column width. */
export function ResumeRenderer({
  resume,
  onReady,
}: {
  resume: Resume;
  onReady?: () => void;
}) {
  const all = useMemo(() => blocks(resume.content), [resume.content]);
  const modern = resume.template === "modern";
  const columns = useMemo(
    () =>
      modern
        ? [
            all.filter((b) => leftTypes.has(b.type)),
            all.filter((b) => !leftTypes.has(b.type)),
          ]
        : [all],
    [all, modern],
  );
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Block[][][]>([columns]);
  const [measured, setMeasured] = useState(false);
  const style = {
    "--resume-color": resume.style.color,
    fontFamily:
      resume.style.font === "noto-serif-kr"
        ? '"Noto Serif KR", serif'
        : "Pretendard, sans-serif",
    fontSize: `${{ small: 9, medium: 10, large: 11 }[resume.style.size]}pt`,
  } as CSSProperties;
  useLayoutEffect(() => {
    let cancelled = false;
    const calculate = async () => {
      await document.fonts?.ready;
      if (cancelled || !measure.current) return;
      const pagedColumns = columns.map((column, columnIndex) => {
        const holder = measure.current!.children[columnIndex] as HTMLElement;
        const pages: Block[][] = [[]];
        let used = 0;
        const budget = 1043; // 1123px paper minus 40px top/bottom padding.
        column.forEach((block, index) => {
          const element = holder.children[index] as HTMLElement;
          const height = element?.getBoundingClientRect().height || 40;
          if (height <= budget) {
            if (used + height > budget) {
              pages.push([]);
              used = 0;
            }
            pages[pages.length - 1].push(block);
            used += height;
          } else if (block.text) {
            // Only an item taller than a whole page is split; binary measurement preserves every character.
            if (used > 0) {
              pages.push([]);
              used = 0;
            }
            let remaining = block.text;
            let part = 0;
            while (remaining.length) {
              const probe = element.cloneNode(true) as HTMLElement;
              holder.appendChild(probe);
              let low = 1;
              let high = remaining.length;
              while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                probe.querySelector("p")!.textContent = remaining.slice(
                  0,
                  middle,
                );
                if (probe.getBoundingClientRect().height <= budget)
                  low = middle;
                else high = middle - 1;
              }
              probe.querySelector("p")!.textContent = remaining.slice(0, low);
              const fragmentHeight =
                probe.getBoundingClientRect().height || budget;
              probe.remove();
              pages[pages.length - 1].push({
                ...block,
                key: `${block.key}-${part++}`,
                text: remaining.slice(0, low),
              });
              remaining = remaining.slice(low);
              used = fragmentHeight;
              if (remaining) {
                pages.push([]);
                used = 0;
              }
            }
          } else {
            // Basics contacts can be arbitrarily long; preserve them rather than clipping the paper.
            pages[pages.length - 1].push(block);
            used += height;
          }
        });
        return pages;
      });
      const count = Math.max(1, ...pagedColumns.map((column) => column.length));
      setPages(
        Array.from({ length: count }, (_, page) =>
          pagedColumns.map((column) => column[page] ?? []),
        ),
      );
      setMeasured(true);
    };
    void calculate();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => void calculate())
        : undefined;
    if (measure.current) observer?.observe(measure.current);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [columns, resume.style.font, resume.style.size]);
  useLayoutEffect(() => {
    if (measured) onReady?.();
  }, [pages, measured, onReady]);
  return (
    <div className="resume-renderer" style={style}>
      <div
        ref={measure}
        aria-hidden="true"
        className={`paper-measure ${modern ? "modern" : ""}`}
      >
        {columns.map((column, index) => (
          <div className={`paper-column column-${index}`} key={index}>
            {column.map((block) => (
              <PaperBlock key={block.key} block={block} />
            ))}
          </div>
        ))}
      </div>
      {pages.map((columns, page) => (
        <article
          className={`resume-paper ${modern ? "modern" : ""}`}
          aria-label={`A4 ${page + 1}페이지`}
          key={page}
        >
          {columns.map((column, index) => (
            <div className={`paper-column column-${index}`} key={index}>
              {column.map((block) => (
                <PaperBlock key={block.key} block={block} />
              ))}
            </div>
          ))}
        </article>
      ))}
      <p className="page-count">총 {pages.length}페이지</p>
    </div>
  );
}
