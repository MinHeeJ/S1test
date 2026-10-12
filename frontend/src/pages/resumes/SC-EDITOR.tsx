import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../../app/AppShell';
import { ConfirmModal } from '../../shared/ConfirmModal';
import { Toast } from '../../shared/Toast';
import { resumeApi, currentNickname, logout } from './resumeApi';
import {
  completion, missingFields, newSection, sectionNames, type Resume, type Section, type SectionType,
} from './model';
import { SaveQueue, type SaveState } from './SaveQueue';
import { ResumeRenderer } from './ResumeRenderer';
import { ResumeSortableList } from './ResumeSortableList';
import { SectionFields } from './SectionFields';
import { MissingFieldsModal } from './SC-EDITOR-M1';

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume | null>(null);
  const latest = useRef<Resume | null>(null);
  const queue = useRef<SaveQueue>();
  const [nickname, setNickname] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [state, setState] = useState<SaveState>('저장됨');
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState('입력');
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['basics']));
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [remove, setRemove] = useState<SectionType | null>(null);
  const [missing, setMissing] = useState<ReturnType<typeof missingFields> | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    let mounted = true;
    queue.current?.dispose();
    setResume(null); latest.current = null; setError(null);
    Promise.all([resumeApi.get(id!), currentNickname()]).then(([data, name]) => {
      if (!mounted) return;
      latest.current = data; setResume(data); setNickname(name);
      queue.current = new SaveQueue(data.id, data, setState, e => setToast((e as Error).message));
    }).catch(e => { if (mounted) setError((e as Error).message); });
    return () => { mounted = false; queue.current?.dispose(); iframe.current?.remove(); };
  }, [id]);
  useEffect(() => {
    const panel = preview.current;
    if (!panel) return;
    const fit = () => {
      if (panel.clientWidth > 0) setFitScale(Math.min(1.5, (panel.clientWidth - 56) / 794));
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(panel);
    window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, [!!resume, tab]);
  useEffect(() => {
    if (state === '저장됨') return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [state]);
  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type === 'resume-print-error') setToast('인쇄 자료를 불러오지 못했습니다.');
      if (['resume-print-error', 'resume-print-finished'].includes(event.data?.type)) {
        iframe.current?.remove(); iframe.current = null;
      }
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, []);
  function change(next: Resume) {
    latest.current = next; setResume(next); queue.current?.change(next);
  }
  function changeSection(previous: Section, next: Section) {
    const current = latest.current!;
    // Upload completion changes only its photo field; unrelated in-flight local edits survive.
    const data = next.data && previous.data ? {
      ...current.content.find(s => s.type === next.type)?.data,
      ...Object.fromEntries(Object.entries(next.data).filter(([key, value]) => value !== previous.data?.[key])),
    } : next.data;
    change({ ...current, content: current.content.map(s => s.type === next.type ? { ...next, data } : s) });
  }
  async function flushThen(action: () => Promise<unknown> | void) {
    if (pending) return;
    setPending(true);
    try { await queue.current?.flush(); await action(); }
    catch (e) { setToast((e as Error).message); }
    finally { setPending(false); }
  }
  function exportPdf() {
    const missing = missingFields(latest.current!.content);
    if (missing.length) { setMissing(missing); return; }
    void flushThen(() => {
      iframe.current?.remove();
      const frame = document.createElement('iframe');
      frame.title = '이력서 인쇄';
      frame.setAttribute('aria-hidden', 'true');
      Object.assign(frame.style, {
        position: 'fixed', left: '-10000px', width: '794px', height: '1123px', border: '0',
      });
      frame.src = `/print/${encodeURIComponent(latest.current!.id)}`;
      iframe.current = frame; document.body.append(frame);
    });
  }
  function focus(path: string) {
    const type = path.split('-')[0];
    const section = latest.current!.content.find(s => s.type === type);
    const item = section?.items?.find(item => path.includes(String(item.id)));
    setMissing(null); setSettings(false); setTab('입력');
    setExpanded(previous => new Set([...previous, type])); setActiveItem(item ? String(item.id) : null);
    requestAnimationFrame(() => document.getElementById(path)?.focus());
  }
  function sectionCard(section: Section) {
    const opened = expanded.has(section.type);
    return (
      <section className={`section-card ${section.hidden ? 'hidden-section' : ''}`}>
        <div className="section-heading">
          <button aria-expanded={opened} onClick={() => {
            setExpanded(previous => {
              const next = new Set(previous);
              if (opened) next.delete(section.type); else next.add(section.type);
              return next;
            });
            if (!opened && !section.hidden) {
              preview.current?.querySelector(`[data-section="${section.type}"]`)?.scrollIntoView({ block: 'nearest' });
            }
          }}>
            {sectionNames[section.type]} {section.items ? `(${section.items.length})` : ''} {opened ? '⌃' : '⌄'}
          </button>
          {section.type !== 'basics' && (
            <>
              <button onClick={() => changeSection(section, { ...section, hidden: !section.hidden })}>
                {section.hidden ? '표시' : '숨김'}
              </button>
              <button onClick={() => setRemove(section.type)}>섹션 삭제</button>
            </>
          )}
        </div>
        {opened && <SectionFields
          section={section}
          activeItem={activeItem}
          onActiveItem={setActiveItem}
          onChange={next => changeSection(section, next)}
          onError={setToast}
        />}
      </section>
    );
  }
  const score = resume ? completion(resume.content) : null;
  const toolbar = resume && (
    <div className="resume-toolbar">
      <button disabled={pending} onClick={() => void flushThen(() => navigate('/resumes'))}>← 목록</button>
      {editingTitle ? <input
        aria-label="이력서 제목"
        value={title}
        disabled={pending}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') setEditingTitle(false);
          if (e.key === 'Enter' && !pending) {
            setPending(true);
            void queue.current!.rename(title).then(() => {
              const next = { ...latest.current!, title: queue.current!.snapshot.title };
              latest.current = next; setResume(next); setEditingTitle(false);
            }).catch(e => setToast((e as Error).message)).finally(() => setPending(false));
          }
        }}
      /> : <button onClick={() => { setTitle(resume.title); setEditingTitle(true); }}>{resume.title}</button>}
      <button onClick={() => void queue.current?.flush().catch(() => {})}>{state}</button>
      <button onClick={() => setSettings(!settings)}>템플릿·스타일</button>
      <button className="primary" disabled={pending} onClick={exportPdf}>PDF 내보내기</button>
    </div>
  );
  return (
    <AppShell
      nickname={nickname}
      pending={pending}
      onLogout={() => flushThen(async () => { await logout(); navigate('/login'); })}
      toolbar={toolbar}
    >
      {error && (
        <div role="alert" className="empty-state">
          {error}
          <button onClick={() => navigate('/resumes')}>목록</button>
        </div>
      )}
      {!resume && !error && <p role="status">이력서를 불러오는 중…</p>}
      {resume && (
        <>
          <div className="editor-tabs" role="tablist">
            {['입력', '미리보기'].map(value => <button
              role="tab"
              key={value}
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >{value}</button>)}
          </div>
          <div className={`resume-workspace tab-${tab === '입력' ? 'input' : 'preview'}`}>
            <aside className="input-panel">
              <div className="completion-card">
                <button onClick={() => setShowCriteria(!showCriteria)}>완성도 {score!.score}%</button>
                <div className="completion-track">
                  <span style={{ width: `${score!.score}%`, background: score!.color }} />
                </div>
                {showCriteria && (
                  <ul>{score!.criteria.filter(c => !c.met).map(c => <li key={c.label}>{c.label}</li>)}</ul>
                )}
              </div>
              {settings ? <div className="section-fields section-card">
                <h2>템플릿·스타일</h2>
                <label>템플릿<select value={resume.template} onChange={e => change({
                  ...latest.current!, template: e.target.value as Resume['template'],
                })}>
                  <option value="classic">Classic</option><option value="modern">Modern</option>
                </select></label>
                <label>강조색<select value={resume.style.color} onChange={e => change({
                  ...latest.current!, style: { ...latest.current!.style, color: e.target.value },
                })}>
                  {['#1F3A5F', '#2563EB', '#0F766E', '#9F1239', '#C2410C', '#374151'].map(color =>
                    <option key={color} value={color}>{color}</option>)}
                </select></label>
                <label>글꼴<select value={resume.style.font} onChange={e => change({
                  ...latest.current!,
                  style: { ...latest.current!.style, font: e.target.value as Resume['style']['font'] },
                })}>
                  <option value="pretendard">Pretendard</option><option value="noto-serif-kr">Noto Serif KR</option>
                </select></label>
                <label>글자 크기<select value={resume.style.size} onChange={e => change({
                  ...latest.current!,
                  style: { ...latest.current!.style, size: e.target.value as Resume['style']['size'] },
                })}>
                  <option value="small">9pt</option>
                  <option value="medium">10pt</option>
                  <option value="large">11pt</option>
                </select></label>
                <button onClick={() => setSettings(false)}>입력으로 돌아가기</button>
              </div> : <>
                {sectionCard(resume.content[0])}
                <ResumeSortableList ids={resume.content.slice(1).map(s => s.type)} onMove={(from, to) => {
                  const content = [...latest.current!.content];
                  content.splice(to + 1, 0, content.splice(from + 1, 1)[0]); change({ ...latest.current!, content });
                }}>
                  {(_, index) => sectionCard(resume.content[index + 1])}
                </ResumeSortableList>
                <label>섹션 추가<select value="" onChange={e => {
                  const type = e.target.value as SectionType;
                  change({ ...latest.current!, content: [...latest.current!.content, newSection(type)] });
                  setExpanded(previous => new Set([...previous, type]));
                }}>
                  <option value="" disabled>추가할 섹션 선택</option>
                  {(Object.keys(sectionNames) as SectionType[])
                    .filter(type => !resume.content.some(s => s.type === type))
                    .map(type => <option key={type} value={type}>{sectionNames[type]}</option>)}
                </select></label>
              </>}
            </aside>
            <section className="preview-panel" ref={preview} aria-label="실시간 미리보기">
              <div className="zoom-controls">
                <button onClick={() => setZoom(null)}>맞춤</button>
                <label>배율
                  <select
                    value={zoom ?? 'fit'}
                    onChange={e => setZoom(e.target.value === 'fit' ? null : +e.target.value)}
                  >
                  <option value="fit">맞춤</option>
                  {[50, 75, 100, 125, 150].map(value => <option key={value} value={value}>{value}%</option>)}
                </select></label>
              </div>
              <div className="paper-viewport" style={{ zoom: zoom === null ? fitScale : zoom / 100 }}>
                <ResumeRenderer resume={resume} />
              </div>
            </section>
          </div>
        </>
      )}
      <MissingFieldsModal missing={missing} onClose={() => setMissing(null)} onFocus={focus} />
      <ConfirmModal
        open={!!remove}
        title="섹션을 삭제할까요?"
        onCancel={() => setRemove(null)}
        onConfirm={() => {
          change({ ...latest.current!, content: latest.current!.content.filter(s => s.type !== remove) });
          setRemove(null);
        }}
      >섹션의 모든 항목도 제거됩니다.</ConfirmModal>
      <Toast message={toast} onDismiss={dismissToast} />
    </AppShell>
  );
}
