import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter, createAppRoutes } from './router';
import { configureApi } from '../shared/api';
import type { Resume } from '../pages/resumes/model';

const resume: Resume = {
  id: '20000000-0000-0000-0000-000000000001',
  title: '지원용',
  template: 'classic',
  style: { color: '#1F3A5F', font: 'pretendard', size: 'medium' },
  updated_at: '2026-01-01T00:00:00Z',
  content: [{ type: 'basics', hidden: false, data: {
    name: '지우', jobTitle: '개발자', email: 'jiwoo@resume.dev', phone: '', links: [], photoId: null,
  } }],
};
let authenticated: boolean;
let request: ReturnType<typeof vi.fn>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'X-CSRF-TOKEN': 'session-token' } });
}
function denied(status: number) {
  return json({
    success: false, meta: {}, code: 'REQUEST_DENIED', message: '자료를 조회할 수 없습니다.', field: null,
  }, status);
}
function open(path: string) {
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: [path] });
  configureApi({ onUnauthorized: () => { void router.navigate('/login', { replace: true }); } });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  authenticated = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  Element.prototype.scrollIntoView = vi.fn();
  request = vi.fn(async (path: string, init: RequestInit = {}) => {
    if (path === '/api/auth/me') {
      return authenticated ? json({ success: true, meta: {}, data: { nickname: '지우' } }) : denied(401);
    }
    if (path === '/api/auth/login' || path === '/api/auth/signup') {
      authenticated = true;
      return new Response(null, { status: 204 });
    }
    if (!authenticated) return denied(401);
    if (path === '/api/resumes' && init.method === 'POST') {
      return json({ success: true, meta: {}, data: { id: resume.id } }, 201);
    }
    if (path === '/api/resumes') return json({ success: true, meta: {}, data: [resume] });
    if (path === `/api/resumes/${resume.id}` && init.method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `/api/resumes/${resume.id}`) return json({ success: true, meta: {}, data: resume });
    throw new Error(`예상하지 않은 요청: ${path}`);
  });
  vi.stubGlobal('fetch', request);
});
afterEach(() => {
  vi.unstubAllGlobals();
  configureApi({ onUnauthorized: () => {}, onError: () => {} });
  window.history.replaceState(null, '', '/');
});

describe('공유 라우터의 실제 화면 연결', () => {
  it('루트에서 본인 목록을 읽고 카드의 id로 실제 편집기를 연다', async () => {
    const router = open('/');
    fireEvent.click(await screen.findByRole('link', { name: '지원용 편집' }));
    expect(await screen.findByLabelText('이름')).toHaveValue('지우');
    expect(router.state.location.pathname).toBe(`/resumes/${resume.id}/edit`);
    expect(request.mock.calls.some(([path]) => path === `/api/resumes/${resume.id}`)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '← 목록' }));
    await screen.findByRole('heading', { name: '내 이력서' });
    expect(router.state.location.pathname).toBe('/resumes');
  });

  it('생성 모달은 목록 안에서 열리고 반환한 id의 편집기로 연결된다', async () => {
    const router = open('/resumes');
    await screen.findByRole('link', { name: '지원용 편집' });
    fireEvent.click(screen.getAllByRole('button', { name: '＋ 새 이력서' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '생성' }));
    await screen.findByLabelText('이름');
    expect(router.state.location.pathname).toBe(`/resumes/${resume.id}/edit`);
    const create = request.mock.calls.find(([path, init]) => path === '/api/resumes' && init?.method === 'POST');
    expect(JSON.parse(create![1].body)).toEqual({ title: '새 이력서', template: 'classic' });
  });

  it('필수값 누락 모달은 동일 편집기에서 열리고 입력에 포커스한다', async () => {
    const router = open(`/resumes/${resume.id}/edit`);
    fireEvent.change(await screen.findByLabelText('희망 직무'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'PDF 내보내기' }));
    fireEvent.click(screen.getByRole('button', { name: '기본정보 · 희망 직무' }));
    await waitFor(() => expect(screen.getByLabelText('희망 직무')).toHaveFocus());
    expect(router.state.location.pathname).toBe(`/resumes/${resume.id}/edit`);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('일반 탭 인쇄 진입은 자료 요청·출력·헤더 없이 기존 오류를 표시한다', async () => {
    open(`/print/${resume.id}`);
    expect(screen.getByRole('alert')).toHaveTextContent('PDF 내보내기로만');
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByText('ResumeCraft')).not.toBeInTheDocument();
  });

  it('비로그인은 실제 목록에서 로그인으로 이동하고 가입 링크를 사용할 수 있다', async () => {
    authenticated = false;
    const router = open('/resumes');
    await waitFor(() => expect(screen.getByLabelText('이메일')).toBeEnabled());
    expect(router.state.location.pathname).toBe('/login');
    fireEvent.click(screen.getByRole('link', { name: '회원가입' }));
    await waitFor(() => expect(screen.getByLabelText('닉네임')).toBeEnabled());
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('로그인 성공 후 대체 화면이 아닌 등록된 본인 목록에 도착한다', async () => {
    authenticated = false;
    const router = open('/login');
    await waitFor(() => expect(screen.getByLabelText('이메일')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'jiwoo@resume.dev' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'demo1234' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await screen.findByRole('link', { name: '지원용 편집' });
    expect(router.state.location.pathname).toBe('/resumes');
  });

  it.each(['/login', '/signup'])('인증 사용자의 %s는 실제 목록으로 연결된다', async path => {
    const router = open(path);
    await screen.findByRole('link', { name: '지원용 편집' });
    expect(router.state.location.pathname).toBe('/resumes');
  });

  it('없는 이력서의404는 동일 편집기에서 오류를 표시하고 로그인으로 이동하지 않는다', async () => {
    request.mockImplementation(async (path: string) => path === '/api/auth/me'
      ? json({ success: true, meta: {}, data: { nickname: '지우' } }) : denied(404));
    const router = open('/resumes/missing/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('자료를 조회할 수 없습니다.');
    expect(router.state.location.pathname).toBe('/resumes/missing/edit');
    expect(screen.queryByLabelText('이름')).not.toBeInTheDocument();
  });

  it('실제 브라우저 라우터도 기본 등록과 세션 만료 콜백을 적용한다', async () => {
    authenticated = false;
    window.history.replaceState(null, '', '/resumes');
    const router = createAppRouter([]);
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByLabelText('이메일')).toBeEnabled());
    expect(router.state.location.pathname).toBe('/login');
    router.dispose();
  });
});
