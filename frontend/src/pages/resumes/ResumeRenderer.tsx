import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { sectionNames, type Resume, type Section, type Link } from './model';
import './resumes.css';

interface Block {
  key: string;
  type: string;
  group?: string;
  text?: string;
  kind: 'title' | 'text' | 'basics';
  section?: Section;
}
function blocks(content: Section[]): Block[] {
  return content.filter(s => !s.hidden).flatMap(section => {
    const type = section.type;
    if (type === 'basics') return [{ key: type, type, kind: 'basics' as const, section }];
    const result: Block[] = [{ key: type, type, kind: 'title', text: sectionNames[type] }];
    const add = (text: string, group?: string) => text.split('\n').forEach(line => result.push({
      key: `${type}-${result.length}`, type, group, kind: 'text', text: line,
    }));
    if (type === 'summary') {
      add(String(section.data?.headline ?? ''));
      add(String(section.data?.body ?? ''));
    } else if (type === 'skills') add((section.data?.tags as string[]).join(' · '));
    else section.items?.forEach((item, index) => {
      const group = `${type}-item-${index}`;
      const fields = Object.entries(item).filter(([key]) =>
        !['id', 'current', 'description', 'start', 'end'].includes(key));
      add(fields.map(([, value]) => String(value)).filter(Boolean).join(' · '), group);
      if ('start' in item) add(`${item.start} – ${item.current ? '현재' : item.end}`, group);
      if (typeof item.description === 'string') add(item.description, group);
    });
    return result;
  });
}
function BlockView({ block }: { block: Block }) {
  if (block.kind === 'basics') {
    const data = block.section!.data!;
    return (
      <header className="paper-basics">
        {data.photoId && <img src={`/api/photos/${encodeURIComponent(String(data.photoId))}`} alt="프로필 사진" />}
        <div>
          <h1>{String(data.name)}</h1>
          <p>{String(data.jobTitle)}</p>
          <p>{String(data.email)} {String(data.phone)}</p>
          {(data.links as Link[]).map((link, i) => <p key={i}>{link.label} {link.url}</p>)}
        </div>
      </header>
    );
  }
  if (block.kind === 'title') return <h2 className="paper-section-title">{block.text}</h2>;
  return block.text?.startsWith('- ')
    ? <ul className="paper-bullet"><li>{block.text.slice(2)}</li></ul>
    : <p className="paper-text">{block.text || '\u00a0'}</p>;
}

/** Shared measured A4 pagination for the editor, card thumbnail and iframe print document. */
export function ResumeRenderer({ resume, thumbnail = false, onReady }: {
  resume: Pick<Resume, 'template' | 'style' | 'content'>;
  thumbnail?: boolean;
  onReady?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [thumbnailScale, setThumbnailScale] = useState(.25);
  useLayoutEffect(() => {
    if (!thumbnail) return;
    const container = root.current?.parentElement;
    if (!container) return;
    const fit = () => {
      if (container.clientWidth) setThumbnailScale(container.clientWidth / 794);
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [thumbnail]);
  const source = useMemo(() => blocks(resume.content), [resume.content]);
  const modern = resume.template === 'modern';
  const sideTypes = ['basics', 'skills', 'languages', 'certificates'];
  const [pages, setPages] = useState<Block[][][]>([[source, []]]);
  const [ready, setReady] = useState(false);
  const style = {
    '--resume-color': resume.style.color,
    fontFamily: resume.style.font === 'noto-serif-kr' ? '"Noto Serif KR", serif' : 'Pretendard, sans-serif',
    fontSize: `${{ small: 9, medium: 10, large: 11 }[resume.style.size]}pt`,
  } as CSSProperties;
  useLayoutEffect(() => {
    let cancelled = false;
    setReady(false);
    const paginate = () => {
      if (!measure.current || cancelled) return;
      const columns: Block[][][] = [[], []];
      for (let col = 0; col < (modern ? 2 : 1); col++) {
        const matching = source.filter(b => !modern || (sideTypes.includes(b.type) ? 0 : 1) === col);
        let page: Block[] = [];
        let used = 0;
        const height = 1027;
        let currentGroup: string | undefined;
        for (const block of matching) {
          if (block.group && block.group !== currentGroup) {
            const group = matching.filter(candidate => candidate.group === block.group);
            const groupHeight = group.reduce((sum, candidate) => {
              const element = measure.current!.querySelector<HTMLElement>(`[data-block="${candidate.key}"]`);
              return sum + (element?.offsetHeight || 28);
            }, 0);
            if (groupHeight <= height && used + groupHeight > height && page.length) {
              columns[col].push(page); page = []; used = 0;
            }
          }
          currentGroup = block.group;
          const element = measure.current.querySelector<HTMLElement>(`[data-block="${block.key}"]`);
          const measured = element?.offsetHeight || (block.kind === 'basics' ? 160 : 28);
          // A single oversized paragraph is split at a measured character boundary, never clipped.
          if (measured > height && block.kind === 'text' && element && block.text) {
            let remaining = block.text;
            const probe = element.cloneNode(true) as HTMLElement;
            probe.removeAttribute('data-block');
            measure.current.append(probe);
            const text = probe.querySelector('p, li') ?? probe;
            while (remaining.length) {
              let low = 1;
              let high = remaining.length;
              while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                text.textContent = remaining.slice(0, middle);
                if (probe.offsetHeight <= height - used) low = middle;
                else high = middle - 1;
              }
              if (used > 0 && low < 2) { columns[col].push(page); page = []; used = 0; continue; }
              const part = remaining.slice(0, low);
              text.textContent = part;
              page.push({ ...block, key: `${block.key}-${remaining.length}`, text: part });
              used += probe.offsetHeight;
              remaining = remaining.slice(low);
              if (remaining) { columns[col].push(page); page = []; used = 0; }
            }
            probe.remove();
          } else {
            if (used + measured > height && page.length) { columns[col].push(page); page = []; used = 0; }
            page.push(block);
            used += measured;
          }
        }
        columns[col].push(page);
      }
      const count = Math.max(columns[0].length, columns[1].length);
      setPages(Array.from({ length: count }, (_, i) => [columns[0][i] ?? [], columns[1][i] ?? []]));
      setReady(true);
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(paginate);
    const images = Array.from(measure.current?.querySelectorAll('img') ?? []);
    images.forEach(image => image.addEventListener('load', paginate));
    return () => { cancelled = true; images.forEach(image => image.removeEventListener('load', paginate)); };
  }, [source, modern, resume.style.font, resume.style.size]);
  useLayoutEffect(() => { if (ready) onReady?.(); }, [ready, onReady]);
  return (
    <div
      ref={root}
      className={`resume-renderer ${thumbnail ? 'thumbnail' : ''}`}
      style={{ ...style, zoom: thumbnail ? thumbnailScale : undefined }}
    >
      <div ref={measure} className={`paper-measure ${modern ? 'modern' : 'classic'}`} aria-hidden="true">
        {source.map(block => (
          <div
            key={block.key}
            data-block={block.key}
            className={`measure-block ${modern && sideTypes.includes(block.type) ? 'side' : 'main'}`}
          >
            <BlockView block={block} />
          </div>
        ))}
      </div>
      {!thumbnail && <p className="page-count">총 {pages.length}페이지</p>}
      {(thumbnail ? pages.slice(0, 1) : pages).map((columns, page) => (
        <article className={`resume-paper ${resume.template}`} key={page} aria-label={`이력서 ${page + 1}페이지`}>
          {columns.map((column, index) => (
            <div className={`paper-column column-${index}`} key={index}>
              {column.map(block => (
                <div key={block.key} data-section={block.type} className="paper-block">
                  <BlockView block={block} />
                </div>
              ))}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
