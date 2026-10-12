import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../../app/AppShell';
import { ConfirmModal } from '../../shared/ConfirmModal';
import { Toast } from '../../shared/Toast';
import { resumeApi, currentNickname, logout } from './resumeApi';
import { ResumeRenderer } from './ResumeRenderer';
import { CreateResumeModal } from './SC-RESUMES-M1';
import type { Resume } from './model';

export function ResumesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Resume[] | null>(null);
  const [nickname, setNickname] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [pending, setPending] = useState(false);
  const [create, setCreate] = useState(false);
  const [remove, setRemove] = useState<Resume | null>(null);
  const [rename, setRename] = useState<Resume | null>(null);
  const [title, setTitle] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  async function load() {
    setError(null);
    try {
      const [list, name] = await Promise.all([resumeApi.list(), currentNickname()]);
      setRows(list); setNickname(name);
    } catch (e) { setRows(null); setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  async function command(action: () => Promise<unknown>, success: () => void) {
    if (pending) return;
    setPending(true);
    try { await action(); success(); } catch (e) { setToast((e as Error).message); }
    finally { setPending(false); }
  }
  return (
    <AppShell
      nickname={nickname}
      pending={pending}
      onLogout={() => command(logout, () => navigate('/login'))}
    >
      <div className="resume-library-shell">
        <nav className="resume-navigation" aria-label="내 이력서">
          <Link to="/resumes" aria-current="page">▤ <span>내 이력서</span></Link>
          <button onClick={() => setCreate(true)}>＋ <span>새 이력서</span></button>
        </nav>
        <section className="resume-library">
          <h1>내 이력서</h1>
          {error && <div role="alert">{error}<button onClick={() => void load()}>다시 불러오기</button></div>}
          {!rows && !error && <p role="status">이력서를 불러오는 중…</p>}
          {rows && (
            <div className="resume-grid">
              <button className="new-resume-card" onClick={() => setCreate(true)} disabled={pending}>＋ 새 이력서</button>
              {rows.map(row => (
                <article className="resume-card" key={row.id}>
                  <Link className="resume-thumbnail" to={`/resumes/${row.id}/edit`} aria-label={`${row.title} 편집`}>
                    <ResumeRenderer resume={row} thumbnail />
                  </Link>
                  <div className="card-caption">
                    <Link to={`/resumes/${row.id}/edit`}>{row.title}</Link>
                    <button
                      aria-label={`${row.title} 메뉴`}
                      onClick={() => setMenu(menu === row.id ? null : row.id)}
                    >⋯</button>
                  </div>
                  <time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleString('ko-KR')}</time>
                  {menu === row.id && (
                    <div className="card-menu">
                      <button disabled={pending} onClick={() => { setRename(row); setTitle(row.title); }}>이름 변경</button>
                      <button disabled={pending} onClick={() => void command(
                        () => resumeApi.duplicate(row.id), () => { setMenu(null); void load(); },
                      )}>복제</button>
                      <button disabled={pending} onClick={() => setRemove(row)}>삭제</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {rows?.length === 0 && <p className="empty-state">아직 이력서가 없습니다. 새 이력서를 만들어보세요.</p>}
          {rename && (
            <form className="rename-form" onSubmit={e => {
              e.preventDefault();
              void command(() => resumeApi.rename(rename.id, title), () => { setRename(null); void load(); });
            }}>
              <label>이력서 이름<input value={title} onChange={e => setTitle(e.target.value)} /></label>
              <button disabled={pending}>이름 저장</button>
              <button type="button" disabled={pending} onClick={() => setRename(null)}>취소</button>
            </form>
          )}
        </section>
      </div>
      <CreateResumeModal
        open={create}
        pending={pending}
        onCancel={() => setCreate(false)}
        onCreate={(name, template) => command(async () => {
          const created = await resumeApi.create(name, template);
          navigate(`/resumes/${created.id}/edit`);
        }, () => setCreate(false))}
      />
      <ConfirmModal
        open={!!remove}
        title="이력서를 삭제할까요?"
        pending={pending}
        onCancel={() => setRemove(null)}
        onConfirm={() => command(() => resumeApi.remove(remove!.id), () => { setRemove(null); void load(); })}
      >{remove?.title}</ConfirmModal>
      <Toast message={toast} onDismiss={dismissToast} />
    </AppShell>
  );
}
