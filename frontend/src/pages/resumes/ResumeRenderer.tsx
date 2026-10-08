import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Resume, ResumeSection } from "../../domain/resume/types";
import { sectionLabels } from "./resumeRules";

interface ResumeBlock {
  key: string;
  section: string;
  heading?: string;
  lines: string[];
  photo?: string;
}
const sidebar = new Set(["basics", "skills", "languages", "certificates"]);
function blocksFor(section: ResumeSection): ResumeBlock[] {
  if (section.hidden) return [];
  const base = { section: section.type };
  if (section.type === "basics") {
    const d = section.data;
    return [
      {
        ...base,
        key: "basics",
        heading: d.name ?? "",
        lines: [
          d.jobTitle ?? "",
          d.email ?? "",
          d.phone ?? "",
          ...(d.links ?? []).map(
            (link) => `${link.label ?? ""} ${link.url ?? ""}`,
          ),
        ],
        photo: d.photoId ?? undefined,
      },
    ];
  }
  const heading: ResumeBlock = {
    ...base,
    key: section.type,
    heading: sectionLabels[section.type],
    lines: [],
  };
  if (section.type === "summary")
    return [
      heading,
      {
        ...base,
        key: "summary-body",
        lines: [section.data.headline ?? "", section.data.body ?? ""],
      },
    ];
  if (section.type === "skills")
    return [
      heading,
      {
        ...base,
        key: "skills-tags",
        lines: [(section.data.tags ?? []).join(" · ")],
      },
    ];
  return [
    heading,
    ...section.items.map((item, index) => {
      const row = item as unknown as Record<
        string,
        string | boolean | undefined
      >;
      const lines: string[] = [];
      const keys = {
        experience: ["company", "position"],
        education: ["school", "major", "degree"],
        projects: ["name", "role"],
        certificates: ["name", "issuer", "date"],
        languages: ["language", "test", "score"],
      }[section.type];
      keys.forEach((key) => {
        if (typeof row[key] === "string") lines.push(row[key] as string);
      });
      if (row.start || row.end || row.current)
        lines.push(
          `${row.start ?? ""} — ${row.current ? "현재" : (row.end ?? "")}`,
        );
      if (typeof row.description === "string")
        lines.push(...row.description.split("\n"));
      if (typeof row.url === "string") lines.push(row.url);
      return { ...base, key: `${section.type}-${index}`, lines };
    }),
  ];
}
function Block({ block }: { block: ResumeBlock }) {
  return (
    <section className="resume-block" data-section={block.section}>
      {block.photo && (
        <img
          className="resume-photo"
          src={`/api/photos/${encodeURIComponent(block.photo)}`}
          alt="프로필 사진"
        />
      )}
      {block.heading !== undefined && <h2>{block.heading}</h2>}
      {block.lines.map((line, index) =>
        line.startsWith("- ") ? (
          <p className="resume-bullet" key={index}>
            • {line.substring(2)}
          </p>
        ) : (
          <p key={index}>{line}</p>
        ),
      )}
    </section>
  );
}

/** Fits whole items when possible; only oversized items are split at rendered text/block boundaries. */
export function paginateResumeBlocks(
  blocks: ResumeBlock[],
  measure: (block: ResumeBlock) => number,
  capacity: number,
): ResumeBlock[][] {
  const pages: ResumeBlock[][] = [[]];
  let used = 0;
  function put(block: ResumeBlock) {
    const height = measure(block);
    if (used + height > capacity && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(block);
    used += height;
  }
  for (const block of blocks) {
    if (measure(block) <= capacity) {
      put(block);
      continue;
    }
    if (block.heading !== undefined || block.photo)
      put({ ...block, lines: [] });
    let fragment = 0;
    for (const line of block.lines) {
      let remaining = line;
      do {
        const candidate = (text: string): ResumeBlock => ({
          section: block.section,
          key: `${block.key}-part-${fragment}`,
          lines: [text],
        });
        if (measure(candidate(remaining)) <= capacity) {
          put(candidate(remaining));
          break;
        }
        let low = 1;
        let high = remaining.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (measure(candidate(remaining.slice(0, mid))) <= capacity)
            low = mid;
          else high = mid - 1;
        }
        const boundary = remaining.lastIndexOf(" ", low);
        const length = boundary > 0 ? boundary + 1 : low;
        put(candidate(remaining.slice(0, length)));
        remaining = remaining.slice(length);
        fragment++;
      } while (remaining.length > 0);
    }
  }
  return pages;
}

/** One measured A4 renderer for preview, first-page thumbnail and iframe printing. */
export function ResumeRenderer({
  resume,
  thumbnail = false,
  onPages,
  onReady,
  onError,
}: {
  resume: Resume;
  thumbnail?: boolean;
  onPages?: (pages: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [resourceError, setResourceError] = useState("");
  const [pages, setPages] = useState<ResumeBlock[][][]>([[[], []]]);
  const modern = resume.template === "modern";
  const visible = resume.content.flatMap(blocksFor);
  const columns = modern
    ? [
        visible.filter((b) => sidebar.has(b.section)),
        visible.filter((b) => !sidebar.has(b.section)),
      ]
    : [visible, []];
  const style = {
    "--resume-color": resume.style.color,
    fontFamily:
      resume.style.font === "noto-serif-kr"
        ? '"Noto Serif KR", Georgia, serif'
        : "Pretendard, sans-serif",
    fontSize: `${{ small: 9, medium: 10, large: 11 }[resume.style.size]}pt`,
  } as CSSProperties;
  useLayoutEffect(() => {
    let cancelled = false;
    async function layout() {
      await document.fonts?.ready;
      const root = ref.current;
      if (!root || cancelled) return;
      setResourceError("");
      let failed = false;
      await Promise.all(
        Array.from(root.querySelectorAll("img")).map((img) =>
          img.complete
            ? Promise.resolve().then(() => {
                failed ||= img.naturalWidth === 0;
              })
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => {
                  failed = true;
                  resolve();
                };
              }),
        ),
      );
      if (failed && !cancelled) {
        const message = "사진을 불러오지 못했습니다. 인쇄를 중단했습니다.";
        setResourceError(message);
        onError?.(message);
      }
      if (cancelled) return;
      const paged = columns.map((column, index) => {
        const probe = root.querySelector<HTMLElement>(
          `[data-measure-column="${index}"]`,
        )!;
        const measure = (block: ResumeBlock) => {
          const element = document.createElement("section");
          element.className = "resume-block";
          if (block.heading !== undefined) {
            const title = document.createElement("h2");
            title.textContent = block.heading;
            element.append(title);
          }
          if (block.photo) {
            const photo = document.createElement("div");
            photo.className = "resume-photo";
            element.append(photo);
          }
          block.lines.forEach((line) => {
            const p = document.createElement("p");
            p.textContent = line;
            element.append(p);
          });
          probe.append(element);
          const height = element.offsetHeight;
          element.remove();
          return height;
        };
        return paginateResumeBlocks(column, measure, 1019);
      });
      const count = Math.max(1, ...paged.map((p) => p.length));
      setPages(
        Array.from({ length: count }, (_, index) => [
          paged[0][index] ?? [],
          paged[1][index] ?? [],
        ]),
      );
      onPages?.(count);
      requestAnimationFrame(() => {
        if (!cancelled && !failed) onReady?.();
      });
    }
    void layout();
    return () => {
      cancelled = true;
    };
  }, [
    resume.content,
    resume.template,
    resume.style.color,
    resume.style.font,
    resume.style.size,
  ]);
  return (
    <div
      className={`resume-renderer ${thumbnail ? "is-thumbnail" : ""}`}
      style={style}
    >
      {resourceError && (
        <p className="resume-resource-error" role="alert">
          {resourceError}
        </p>
      )}
      <div
        ref={ref}
        className={`resume-measure ${modern ? "modern" : "classic"}`}
        aria-hidden="true"
      >
        {[0, 1].map((index) => (
          <div
            key={index}
            data-measure-column={index}
            className={`resume-column column-${index}`}
          >
            {columns[index].map((block) => (
              <Block key={block.key} block={block} />
            ))}
          </div>
        ))}
      </div>
      {(thumbnail ? pages.slice(0, 1) : pages).map((columns, index) => (
        <div
          className={`resume-paper ${modern ? "modern" : "classic"}`}
          key={index}
          aria-label={`A4 ${index + 1}페이지`}
        >
          {columns.map((blocks, column) => (
            <div key={column} className={`resume-column column-${column}`}>
              {blocks.map((block) => (
                <Block key={block.key} block={block} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
