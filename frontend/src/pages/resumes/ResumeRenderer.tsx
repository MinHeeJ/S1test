import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { pt, sectionNames, type ResumeWrite, type Section } from "./model";
import { paginateBlocks, type ResumeBlock } from "./pagination";
import "./resumes.css";

const sideTypes = new Set(["basics", "skills", "languages", "certificates"]);
function blocks(section: Section): ResumeBlock[] {
  const type = section.type;
  const heading = sectionNames[type];
  if (type === "basics") {
    const data = section.data!;
    return [
      {
        section: type,
        heading: data.name,
        basics: true,
        photoId: data.photoId,
        lines: [
          data.jobTitle ?? "",
          data.email ?? "",
          data.phone ?? "",
          ...(data.links ?? []).map((link) => `${link.label} ${link.url}`),
        ],
      },
    ];
  }
  if (type === "summary")
    return [
      {
        section: type,
        heading,
        lines: [
          section.data?.headline ?? "",
          ...(section.data?.body ?? "").split(/\r\n?|\n/),
        ],
      },
    ];
  if (type === "skills")
    return [
      {
        section: type,
        heading,
        lines: [section.data?.tags?.join(" · ") ?? ""],
      },
    ];
  if (!section.items?.length) return [{ section: type, heading, lines: [] }];
  return section.items.map((item, index) => {
    let summary: string;
    if (type === "experience") summary = `${item.company} · ${item.position}`;
    else if (type === "education")
      summary = `${item.school} · ${item.major} · ${item.degree}`;
    else if (type === "projects") summary = `${item.name} · ${item.role}`;
    else if (type === "certificates")
      summary = `${item.name} · ${item.issuer} · ${item.date}`;
    else summary = `${item.language} · ${item.test} · ${item.score}`;
    const period =
      "start" in item
        ? `${item.start} – ${item.current ? "현재" : item.end}`
        : "";
    return {
      section: type,
      heading: index === 0 ? heading : undefined,
      lines: [
        summary,
        ...(period ? [period] : []),
        ...(item.url ? [String(item.url)] : []),
        ...String(item.description ?? "").split(/\r\n?|\n/),
      ],
    };
  });
}
function Block({ block }: { block: ResumeBlock }) {
  return (
    <article
      className={`resume-block ${block.basics ? "resume-basics" : ""}`}
      data-section={block.section}
    >
      {block.photoId && (
        <img
          src={`/api/photos/${encodeURIComponent(block.photoId)}`}
          alt="이력서 사진"
        />
      )}
      {block.heading !== undefined && <h2>{block.heading}</h2>}
      {block.lines.map((line, index) =>
        line.startsWith("- ") ? (
          <ul key={index}>
            <li>{line.slice(2)}</li>
          </ul>
        ) : (
          <p key={index}>{line || "\u00a0"}</p>
        ),
      )}
    </article>
  );
}

/** One measured A4 renderer for thumbnail, local preview and persisted iframe print. */
export function ResumeRenderer({
  resume,
  firstPage = false,
  onReady,
}: {
  resume: ResumeWrite;
  firstPage?: boolean;
  onReady?: () => void;
}) {
  const measurement = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<
    { left: ResumeBlock[]; right: ResumeBlock[] }[]
  >([]);
  const modern = resume.template === "modern";
  const styles = {
    "--resume-color": resume.style.color,
    fontFamily:
      resume.style.font === "pretendard"
        ? "Pretendard, sans-serif"
        : '"Noto Serif KR", serif',
    fontSize: `${pt[resume.style.size]}pt`,
  } as CSSProperties;
  useLayoutEffect(() => {
    let cancelled = false;
    const layout = () => {
      if (cancelled || !measurement.current) return;
      const visible = resume.content.filter((section) => !section.hidden);
      const all = visible.flatMap(blocks);
      const measure = (width: number) => (block: ResumeBlock) => {
        const node = document.createElement("article");
        node.className = `resume-block ${block.basics ? "resume-basics" : ""}`;
        node.style.width = `${width}px`;
        if (block.photoId) {
          const image = document.createElement("img");
          image.src = `/api/photos/${encodeURIComponent(block.photoId)}`;
          if (modern && sideTypes.has(block.section)) {
            image.style.cssText = "float:none;display:block;margin:0 0 12px";
          }
          node.append(image);
        }
        if (block.heading !== undefined) {
          const heading = document.createElement("h2");
          heading.textContent = block.heading;
          node.append(heading);
        }
        for (const line of block.lines) {
          const paragraph = document.createElement(
            line.startsWith("- ") ? "ul" : "p",
          );
          if (line.startsWith("- ")) {
            const item = document.createElement("li");
            item.textContent = line.slice(2);
            paragraph.append(item);
          } else paragraph.textContent = line || "\u00a0";
          node.append(paragraph);
        }
        measurement.current!.append(node);
        const height = node.getBoundingClientRect().height;
        node.remove();
        return height;
      };
      const left = modern
        ? paginateBlocks(
            all.filter((block) => sideTypes.has(block.section)),
            1027,
            measure(206),
          )
        : [];
      const right = paginateBlocks(
        modern ? all.filter((block) => !sideTypes.has(block.section)) : all,
        1027,
        measure(modern ? 476 : 698),
      );
      const count = Math.max(left.length, right.length);
      setPages(
        Array.from({ length: count }, (_, index) => ({
          left: left[index] ?? [],
          right: right[index] ?? [],
        })),
      );
    };
    layout();
    void document.fonts?.ready.then(layout);
    return () => {
      cancelled = true;
    };
  }, [
    resume.content,
    resume.template,
    resume.style.color,
    resume.style.font,
    resume.style.size,
    modern,
  ]);
  useLayoutEffect(() => {
    if (pages.length) onReady?.();
  }, [pages, onReady]);
  return (
    <div className="resume-document" style={styles}>
      <div ref={measurement} className="resume-measure" aria-hidden="true" />
      {(firstPage ? pages.slice(0, 1) : pages).map((page, index) => (
        <div
          className={`resume-paper ${modern ? "modern" : "classic"}`}
          key={index}
          aria-label={`A4 ${index + 1}페이지`}
        >
          {modern && (
            <aside className="resume-sidebar">
              {page.left.map((block, i) => (
                <Block block={block} key={i} />
              ))}
            </aside>
          )}
          <div className="resume-main">
            {page.right.map((block, i) => (
              <Block block={block} key={i} />
            ))}
          </div>
        </div>
      ))}
      {!firstPage && <p className="page-count">총 {pages.length}페이지</p>}
    </div>
  );
}
