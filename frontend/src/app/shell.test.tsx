import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AppShell } from './AppShell';
import { ConfirmModal } from '../shared/ConfirmModal';
import { Toast } from '../shared/Toast';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createAppRoutes } from './router';

// This new repository has no existing frontend test; use the common jsdom setup.
afterEach(() => vi.useRealTimers());

describe('공통 화면', () => {
  it('닉네임과 로그아웃은 로그인 사용자에게만 표시한다', () => {
    const logout = vi.fn();
    const view = render(<AppShell><p>본문</p></AppShell>);
    expect(screen.getByText('ResumeCraft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    view.rerender(<AppShell nickname="지우" onLogout={logout}><p>본문</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.getByText('지우')).toBeInTheDocument();
  });

  it('편집기 툴바는 호출자가 제공하는 실제 UI를 유지한다', () => {
    render(<AppShell toolbar={<button>목록</button>}><p>입력</p></AppShell>);
    expect(screen.getByRole('button', { name: '목록' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('입력');
  });

  it('루트는 기존 목록 경로로 이동한다', () => {
    const router = createMemoryRouter(
      createAppRoutes([{ path: '/resumes', element: <p>본인 이력서</p> }]),
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByText('본인 이력서')).toBeInTheDocument();
  });

  it('삭제 확인 취소는 mutation 없이 닫기를 요청한다', () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const cancel = vi.fn();
    const remove = vi.fn();
    render(<ConfirmModal open title="삭제 확인" onCancel={cancel} onConfirm={remove} />);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });

  it('진행 중인 삭제는 중복 명령과 취소를 막는다', () => {
    render(<ConfirmModal open pending title="삭제 확인" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('토스트는 3초 후 사라지도록 요청한다', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    render(<Toast message="저장 완료" onDismiss={dismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('저장 완료');
    act(() => vi.advanceTimersByTime(2999));
    expect(dismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
