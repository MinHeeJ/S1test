import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Resume, ResumeSection } from "../../domain/resume/types";
import { FONT_SIZE_PT } from "../../domain/resume/types";
import { sectionNames } from "./resumeFields";
import "./resumes.css";

interface Block {
  key: string;
  section: string;
  title?: string;
  lines: string[];
  photo?: string;
}
const leftTypes = new Set(["basics", "skills", "languages", "certificates"]);
function blocksFor(section: ResumeSection): Block[] {
  const result: Block[] = [];
  if (section.type !== "basics") {
    result.push({
      key: `${section.type}-heading`,
      section: section.type,
      title: sectionNames[section.type],
      lines: [],
    });
  }
  if (section.type === "basics") {
    const d = section.data;
    result.push({
      key: "basics",
      section: "basics",
      title: d.name,
      photo: d.photoId ?? undefined,
      lines: [
        d.jobTitle,
        d.email,
        d.phone,
        ...(d.links ?? []).map((l) =>
          [l.label, l.url].filter(Boolean).join(" · "),
        ),
      ].filter((v): v is string => typeof v === "string" && Boolean(v)),
    });
  } else if (section.type === "summary") {
    result.push({
      key: "summary-text",
      section: section.type,
      lines: [
        section.data.headline ?? "",
        ...(section.data.body ?? "").split("\n"),
      ],
    });
  } else if (section.type === "skills") {
    result.push({
      key: "skills-text",
      section: section.type,
      lines: [(section.data.tags ?? []).join(" · ")],
    });
  } else {
    section.items.forEach((item, index) => {
      const d = item as Record<string, unknown>;
      const text = (...keys: string[]) =>
        keys
          .map((k) => d[k])
          .filter((v) => typeof v === "string" && v)
          .join(" · ");
      const title = text("company", "school", "name", "language");
      const period =
        d.start || d.end
          ? [d.start, d.current ? "현재" : d.end].filter(Boolean).join(" — ")
          : "";
      result.push({
        key: `${section.type}-${index}`,
        section: section.type,
        title,
        lines: [
          text(
            "position",
            "major",
            "degree",
            "role",
            "test",
            "score",
            "issuer",
          ),
          period,
          text("date"),
          ...(typeof d.description === "string"
            ? d.description.split("\n")
            : []),
          text("url"),
        ].filter(Boolean),
      });
    });
  }
  return result;
}
function BlockView({ block }: { block: Block }) {
  return (
    <section className="resume-block" data-section={block.section}>
      {block.photo && (
        <img
          src={`/api/photos/${encodeURIComponent(block.photo)}`}
          alt="이력서 사진"
        />
      )}
      {block.title !== undefined && <h2>{block.title}</h2>}
      {block.lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </section>
  );
}

/** Uses actual styled DOM heights; whole items move intact, oversized text splits at measured line boundaries. */
function paginate(blocks: Block[], container: HTMLElement): Block[][] {
  const height = 1027;
  const pages: Block[][] = [[]];
  let used = 0;
  const measure = (block: Block, index: number) => {
    const node = container.children[index] as HTMLElement;
    return node.getBoundingClientRect().height;
  };
  blocks.forEach((block, index) => {
    const size = measure(block, index);
    if (size <= height) {
      if (used + size > height && pages[pages.length - 1].length) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(block);
      used += size;
      return;
    }
    // Measure a text-only clone with the exact column width and typography.
    const probe = container.children[index].cloneNode(true) as HTMLElement;
    container.appendChild(probe);
    const setProbe = (candidate: Block) => {
      probe.replaceChildren();
      if (candidate.title) {
        const h = document.createElement("h2");
        h.textContent = candidate.title;
        probe.append(h);
      }
      for (const line of candidate.lines) {
        const p = document.createElement("p");
        p.textContent = line;
        probe.append(p);
      }
      return probe.getBoundingClientRect().height;
    };
    const remaining = [...block.lines];
    let part = 0;
    while (remaining.length) {
      if (used) {
        pages.push([]);
        used = 0;
      }
      const fragment: Block = {
        ...block,
        key: `${block.key}-part-${part}`,
        photo: part === 0 ? block.photo : undefined,
        title: part === 0 ? block.title : undefined,
        lines: [],
      };
      while (remaining.length) {
        const line = remaining[0];
        if (
          setProbe({ ...fragment, lines: [...fragment.lines, line] }) <= height
        ) {
          fragment.lines.push(remaining.shift()!);
        } else {
          if (fragment.lines.length) break;
          const chars = Array.from(line);
          let low = 1;
          let high = chars.length;
          while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (
              setProbe({
                ...fragment,
                lines: [chars.slice(0, mid).join("")],
              }) <= height
            )
              low = mid;
            else high = mid - 1;
          }
          // Find the last visual line boundary using the actual text Range rectangles.
          const p = probe.querySelector("p");
          let boundary = low;
          if (p && p.firstChild) {
            p.textContent = chars.slice(0, low).join("");
            const text = p.firstChild!;
            const range = document.createRange();
            let lastTop = -1;
            let lastStart = 0;
            for (let offset = 0; offset < text.textContent!.length; offset++) {
              range.setStart(text, offset);
              range.setEnd(text, offset + 1);
              const top = range.getBoundingClientRect().top;
              if (top !== lastTop) {
                lastTop = top;
                lastStart = offset;
              }
            }
            if (lastStart > 0)
              boundary = Array.from(
                text.textContent!.slice(0, lastStart),
              ).length;
          }
          fragment.lines.push(chars.slice(0, boundary).join(""));
          remaining[0] = chars.slice(boundary).join("");
          if (!remaining[0]) remaining.shift();
          break;
        }
      }
      pages[pages.length - 1].push(fragment);
      used = setProbe(fragment);
      part++;
    }
    probe.remove();
  });
  return pages;
}

export interface ResumeRendererProps {
  resume: Resume;
  onReady?: (pages: number) => void;
  onError?: (message: string) => void;
}
export function ResumeRenderer({
  resume,
  onReady,
  onError,
}: ResumeRendererProps) {
  const modern = resume.template === "modern";
  const blocks = useMemo(
    () => resume.content.filter((s) => !s.hidden).flatMap(blocksFor),
    [resume.content],
  );
  const left = useMemo(
    () => (modern ? blocks.filter((b) => leftTypes.has(b.section)) : blocks),
    [blocks, modern],
  );
  const right = useMemo(
    () => (modern ? blocks.filter((b) => !leftTypes.has(b.section)) : []),
    [blocks, modern],
  );
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<{ left: Block[][]; right: Block[][] }>();
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const style = {
    "--resume-color": resume.style.color,
    fontFamily:
      resume.style.font === "pretendard"
        ? "Pretendard, sans-serif"
        : '"Noto Serif KR Variable", serif',
    fontSize: `${FONT_SIZE_PT[resume.style.size]}pt`,
  } as CSSProperties;
  useLayoutEffect(() => {
    let cancelled = false;
    const calculate = () => {
      if (cancelled || !leftRef.current || !rightRef.current) return;
      try {
        const measured = {
          left: paginate(left, leftRef.current),
          right: paginate(right, rightRef.current),
        };
        setPages(measured);
        callbacks.current.onReady?.(
          Math.max(measured.left.length, measured.right.length),
        );
      } catch {
        callbacks.current.onError?.("미리보기를 만들지 못했습니다.");
      }
    };
    if (document.fonts) void document.fonts.ready.then(calculate);
    else calculate();
    return () => {
      cancelled = true;
    };
  }, [left, right, resume.style.font, resume.style.size]);
  return (
    <div
      className={`resume-renderer ${modern ? "modern" : "classic"}`}
      style={style}
    >
      <div className="resume-measure" aria-hidden="true">
        <div className="paper-column left-column" ref={leftRef}>
          {left.map((block) => (
            <BlockView key={block.key} block={block} />
          ))}
        </div>
        <div className="paper-column right-column" ref={rightRef}>
          {right.map((block) => (
            <BlockView key={block.key} block={block} />
          ))}
        </div>
      </div>
      {!pages && <p role="status">미리보기 준비 중…</p>}
      {pages &&
        Array.from(
          { length: Math.max(pages.left.length, pages.right.length) },
          (_, index) => (
            <div
              className="resume-paper"
              key={index}
              aria-label={`A4 ${index + 1}페이지`}
            >
              <div className="paper-column left-column">
                {(pages.left[index] ?? []).map((block) => (
                  <BlockView key={block.key} block={block} />
                ))}
              </div>
              {modern && (
                <div className="paper-column right-column">
                  {(pages.right[index] ?? []).map((block) => (
                    <BlockView key={block.key} block={block} />
                  ))}
                </div>
              )}
            </div>
          ),
        )}
    </div>
  );
}
