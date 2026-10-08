import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Resume, ResumeSection } from "../../domain/resume/types";
import { sectionNames } from "./resumeEditing";
import "./resumes.css";
import { PhotoImage } from "../photos/PhotoImage";

interface Block {
  key: string;
  type: string;
  title?: string;
  text: string;
  photo?: string | null;
}
function blocks(section: ResumeSection): Block[] {
  const heading = {
    key: `${section.type}-heading`,
    type: section.type,
    title: sectionNames[section.type],
    text: "",
  };
  if (section.type === "basics") {
    const d = section.data;
    return [
      {
        key: "basics",
        type: section.type,
        title: d.name,
        photo: d.photoId,
        text: [
          d.jobTitle,
          d.email,
          d.phone,
          ...(d.links ?? []).map((l) => `${l.label} ${l.url}`),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
  }
  if (section.type === "summary")
    return [
      heading,
      {
        key: "summary",
        type: section.type,
        text: [section.data.headline, section.data.body]
          .filter(Boolean)
          .join("\n"),
      },
    ];
  if (section.type === "skills")
    return [
      heading,
      {
        key: "skills",
        type: section.type,
        text: (section.data.tags ?? []).join(" · "),
      },
    ];
  return [
    heading,
    ...section.items.map((raw, i) => {
      const item = raw as unknown as Record<string, string | boolean>;
      const text = Object.entries(item)
        .filter(([key]) => !["id", "current", "end", "start"].includes(key))
        .map(([, value]) => String(value))
        .filter(Boolean);
      if (item.start || item.end || item.current) {
        text.splice(
          1,
          0,
          `${item.start ?? ""} – ${item.current ? "현재" : (item.end ?? "")}`,
        );
      }
      return {
        key: `${section.type}-${i}`,
        type: section.type,
        text: text.join("\n"),
      };
    }),
  ];
}
function PaperBlock({ block }: { block: Block }) {
  return (
    <section className="paper-block" data-section={block.type}>
      {block.photo && <PhotoImage photoId={block.photo} />}
      {block.title && <h2>{block.title}</h2>}
      {block.text.split("\n").map((line, i) => (
        <p key={i}>{line.startsWith("- ") ? `• ${line.slice(2)}` : line}</p>
      ))}
    </section>
  );
}

/** The same measured A4 pages are used by preview, thumbnail and print; no server rendering. */
export function ResumeRenderer({
  resume,
  onPages,
  onReady,
}: {
  resume: Resume;
  onPages?: (count: number) => void;
  onReady?: () => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<Block[][][]>([[[]], [[]]]);
  const source = useMemo(
    () => resume.content.filter((s) => !s.hidden).flatMap(blocks),
    [resume.content],
  );
  const modern = resume.template === "modern";
  const style = {
    "--resume-color": resume.style.color,
    fontFamily:
      resume.style.font === "noto-serif-kr"
        ? '"Noto Serif KR", serif'
        : "Pretendard, sans-serif",
    fontSize: `${{ small: 9, medium: 10, large: 11 }[resume.style.size]}pt`,
  } as CSSProperties;
  useLayoutEffect(() => {
    if (!measure.current) return;
    const nodes = Array.from(measure.current.children) as HTMLElement[];
    const pages: Block[][][] = [[[]], [[]]];
    const heights = [0, 0];
    source.forEach((block, index) => {
      const column =
        modern &&
        ["basics", "skills", "languages", "certificates"].includes(block.type)
          ? 0
          : 1;
      const node = nodes[index];
      const height = node.getBoundingClientRect().height || 30;
      const add = (piece: Block, measured: number) => {
        if (heights[column] + measured > 1015 && pages[column].at(-1)!.length) {
          pages[column].push([]);
          heights[column] = 0;
        }
        pages[column].at(-1)!.push(piece);
        heights[column] += measured;
      };
      if (height <= 1015) add(block, height);
      else {
        // Only oversized items split. Measure each fragment in the actual column and font.
        const words = Array.from(block.text);
        let start = 0;
        while (start < words.length) {
          let low = 1;
          let high = words.length - start;
          const clone = node.firstElementChild!.cloneNode(false) as HTMLElement;
          clone.style.width = `${node.getBoundingClientRect().width}px`;
          const parent = node.parentElement!;
          parent.appendChild(clone);
          while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            clone.textContent = words.slice(start, start + mid).join("");
            if (clone.getBoundingClientRect().height <= 965) low = mid;
            else high = mid - 1;
          }
          clone.textContent = words.slice(start, start + low).join("");
          const fragmentHeight = clone.getBoundingClientRect().height + 40;
          clone.remove();
          add(
            {
              ...block,
              key: `${block.key}-${start}`,
              title: start === 0 ? block.title : undefined,
              photo: start === 0 ? block.photo : null,
              text: words.slice(start, start + low).join(""),
            },
            fragmentHeight,
          );
          start += low;
        }
      }
    });
    setColumns(pages);
    onPages?.(Math.max(pages[0].length, pages[1].length));
  }, [
    source,
    modern,
    resume.style.color,
    resume.style.font,
    resume.style.size,
    onPages,
  ]);
  useLayoutEffect(() => {
    onReady?.();
  }, [columns, onReady]);
  const count = Math.max(columns[0].length, columns[1].length);
  return (
    <div className="resume-renderer" style={style}>
      <div
        ref={measure}
        className={`paper-measure ${modern ? "modern" : ""}`}
        aria-hidden="true"
      >
        {source.map((block) => (
          <div
            key={block.key}
            className={
              modern &&
              ["basics", "skills", "languages", "certificates"].includes(
                block.type,
              )
                ? "measure-left"
                : "measure-right"
            }
          >
            <PaperBlock block={block} />
          </div>
        ))}
      </div>
      {Array.from({ length: count }, (_, page) => (
        <article
          className={`resume-paper ${modern ? "modern" : "classic"}`}
          aria-label={`이력서 ${page + 1}페이지`}
          key={page}
        >
          {modern && (
            <aside className="paper-left">
              {columns[0][page]?.map((block) => (
                <PaperBlock key={block.key} block={block} />
              ))}
            </aside>
          )}
          <div className="paper-right">
            {columns[1][page]?.map((block) => (
              <PaperBlock key={block.key} block={block} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
