import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createAppRoutes } from '../../app/router';
import { AppShell } from '../../app/AppShell';
import { ApiError } from '../../shared/api';
import { getCurrentUser, login, signup } from './authApi';

vi.mock('./authApi', () => ({ getCurrentUser: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() }));

const anonymous = new ApiError(401, {
  success: false, meta: {}, code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.', field: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockRejectedValue(anonymous);
  vi.mocked(login).mockResolvedValue(undefined);
  vi.mocked(signup).mockResolvedValue(undefined);
});

function open(path = '/login') {
  const router = createMemoryRouter(createAppRoutes([
    { path: '/resumes', element: <AppShell nickname="지우" onLogout={() => {}}><h1>내 이력서</h1></AppShell> },
  ]), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

async function ready() {
  await waitFor(() => expect(screen.getByLabelText('이메일')).toBeEnabled());
}

function credentials() {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'jiwoo@resume.dev' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'demo1234' } });
}

function registration() {
  credentials();
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '지우' } });
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'demo1234' } });
}

describe('인증 화면과 실제 등록 경로', () => {
  it('비로그인 login에는 로고와 빈 마스킹 폼만 있고 signup으로 이동한다', async () => {
    const router = open();
    await ready();
    expect(screen.getByText('ResumeCraft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveValue('');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('link', { name: '회원가입' }));
    await screen.findByLabelText('닉네임');
    expect(router.state.location.pathname).toBe('/signup');
    expect(login).not.toHaveBeenCalled();
    expect(signup).not.toHaveBeenCalled();
  });

  it('signup의 로그인 링크로 기존 /login에 도착한다', async () => {
    const router = open('/signup');
    await ready();
    expect(screen.getByLabelText('비밀번호 확인')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('link', { name: '로그인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument();
  });

  it.each(['/login', '/signup'])('기존 로그인 사용자는 %s에서 /resumes로 이동한다', async path => {
    vi.mocked(getCurrentUser).mockResolvedValue({ nickname: '지우' });
    const router = open(path);
    await screen.findByRole('heading', { name: '내 이력서' });
    expect(router.state.location.pathname).toBe('/resumes');
    expect(login).not.toHaveBeenCalled();
    expect(signup).not.toHaveBeenCalled();
  });

  it('초기 사용자 조회 중에는 입력과 제출이 비활성이다', () => {
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}));
    open();
    expect(screen.getByRole('status')).toHaveTextContent('현재 사용자 확인 중');
    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();
  });

  it('초기 조회의 서버 오류는 같은 화면에서 표시하며 가짜 인증·명령을 만들지 않는다', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('사용자 조회 실패'));
    const router = open();
    await screen.findByText('사용자 조회 실패');
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();
    expect(login).not.toHaveBeenCalled();
    vi.mocked(getCurrentUser).mockRejectedValue(anonymous);
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    await ready();
  });

  it('login은 입력값을 원문 전송하고 me가 성공한 뒤에만 목록으로 이동한다', async () => {
    const router = open();
    await ready();
    credentials();
    let resolve!: (value: { nickname: string }) => void;
    vi.mocked(getCurrentUser).mockReturnValue(new Promise(done => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'jiwoo@resume.dev', password: 'demo1234' }));
    expect(router.state.location.pathname).toBe('/login');
    await act(async () => { resolve({ nickname: '지우' }); });
    await screen.findByRole('heading', { name: '내 이력서' });
    expect(router.state.location.pathname).toBe('/resumes');
  });

  it('login 처리 중 중복 제출은 무시하고 입력을 비활성화한다', async () => {
    vi.mocked(login).mockReturnValue(new Promise(() => {}));
    open();
    await ready();
    credentials();
    const button = screen.getByRole('button', { name: '로그인' });
    fireEvent.click(button);
    fireEvent.submit(button.closest('form')!);
    expect(login).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('비밀번호')).toBeDisabled();
  });

  it('login 자격 오류는 실제 메시지를 표시하고 이동·자동재시도하지 않는다', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, {
      success: false, meta: {}, code: 'INVALID_CREDENTIALS', message: '자격 증명 확인 실패', field: null,
    }));
    const router = open();
    await ready();
    credentials();
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('자격 증명 확인 실패'));
    expect(screen.getByRole('status')).toHaveTextContent('자격 증명 확인 실패');
    expect(router.state.location.pathname).toBe('/login');
    expect(login).toHaveBeenCalledOnce();
  });

  it('login 성공 후 me 실패도 목록으로 이동하지 않는다', async () => {
    const router = open();
    await ready();
    credentials();
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('로그인이 필요합니다.'));
    expect(router.state.location.pathname).toBe('/login');
    expect(login).toHaveBeenCalledOnce();
  });

  it('빈 로그인 필드는 API 없이 해당 필드에 경고를 표시한다', async () => {
    open();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('가입 확인 불일치에는 요청하지 않고 확인 입력에 포커스한다', async () => {
    open('/signup');
    await ready();
    registration();
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호 확인')).toHaveFocus();
    expect(signup).not.toHaveBeenCalled();
  });

  it.each([
    ['이메일', 'abc@', '이메일 형식을 확인해주세요.'],
    ['닉네임', '한', '닉네임은 2~12자여야 합니다.'],
    ['닉네임', 'abcdefghijklmn', '닉네임은 2~12자여야 합니다.'],
    ['비밀번호', '1234567', '비밀번호는 8자 이상이어야 합니다.'],
  ])('가입 %s 검증 실패는 API를 호출하지 않는다', async (label, value, message) => {
    open('/signup');
    await ready();
    registration();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it('가입 성공은 확인값을 전송하지 않고 자동 로그인 identity 확인 후 목록으로 이동한다', async () => {
    const router = open('/signup');
    await ready();
    registration();
    vi.mocked(getCurrentUser).mockResolvedValue({ nickname: '지우' });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    await screen.findByRole('heading', { name: '내 이력서' });
    expect(signup).toHaveBeenCalledOnce();
    expect(signup).toHaveBeenCalledWith({ email: 'jiwoo@resume.dev', nickname: '지우', password: 'demo1234' });
    expect(login).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/resumes');
  });

  it('가입 중 중복 제출은 차단한다', async () => {
    vi.mocked(signup).mockReturnValue(new Promise(() => {}));
    open('/signup');
    await ready();
    registration();
    const button = screen.getByRole('button', { name: '회원가입' });
    fireEvent.click(button);
    fireEvent.submit(button.closest('form')!);
    expect(signup).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
  });

  it('중복 이메일 서버 오류는 email 아래 표시하고 이동하지 않는다', async () => {
    vi.mocked(signup).mockRejectedValue(new ApiError(409, {
      success: false, meta: {}, code: 'DUPLICATE_EMAIL', message: '이미 가입된 이메일입니다', field: 'email',
    }));
    const router = open('/signup');
    await ready();
    registration();
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    await waitFor(() => expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByLabelText('이메일')).toHaveAccessibleDescription('이미 가입된 이메일입니다');
    expect(router.state.location.pathname).toBe('/signup');
    expect(signup).toHaveBeenCalledOnce();
  });
});
