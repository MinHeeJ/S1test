import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resumeApi } from './resumeApi';
import { ResumeRenderer } from './ResumeRenderer';
import type { Resume } from './model';

/** Only a same-origin editor iframe may disclose and print the saved document. */
export function PrintPage() {
  const { id } = useParams();
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rendered = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const inFrame = window.self !== window.top;
  useEffect(() => {
    if (!inFrame) return;
    let mounted = true;
    resumeApi.get(id!).then(data => { if (mounted) setResume(data); }).catch(e => {
      if (mounted) setError((e as Error).message);
      window.parent.postMessage({ type: 'resume-print-error' }, window.location.origin);
    });
    const finished = () => window.parent.postMessage({ type: 'resume-print-finished' }, window.location.origin);
    window.addEventListener('afterprint', finished);
    return () => { mounted = false; window.removeEventListener('afterprint', finished); };
  }, [id, inFrame]);
  const ready = useCallback(() => {
    if (!resume || started.current || !inFrame) return;
    started.current = true;
    const prepare = async () => {
      await (document.fonts?.ready ?? Promise.resolve());
      const images = Array.from(rendered.current?.querySelectorAll('.resume-paper img') ?? []) as HTMLImageElement[];
      await Promise.all(images.map(image => new Promise<void>((resolve, reject) => {
        if (image.complete) { if (image.naturalWidth > 0) resolve(); else reject(new Error('사진 로드 실패')); }
        else { image.onload = () => resolve(); image.onerror = () => reject(new Error('사진 로드 실패')); }
      })));
      const data = resume.content[0].data!;
      document.title = `${data.name}_${data.jobTitle}_이력서`;
      requestAnimationFrame(() => window.print());
    };
    void prepare().catch(e => {
      setError((e as Error).message);
      window.parent.postMessage({ type: 'resume-print-error' }, window.location.origin);
    });
  }, [resume, inFrame]);
  if (!inFrame) return <p role="alert">인쇄 화면은 편집기의 PDF 내보내기로만 열 수 있습니다.</p>;
  if (error) return <p role="alert">{error}</p>;
  return (
    <div className="print-document" ref={rendered}>
      {resume ? <ResumeRenderer resume={resume} onReady={ready} /> : <p role="status">인쇄 자료를 불러오는 중…</p>}
    </div>
  );
}
