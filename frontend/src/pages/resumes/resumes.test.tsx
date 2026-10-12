import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { resumeRoutes } from './routes';
import { resumeApi, currentNickname, logout } from './resumeApi';
import { CreateResumeModal } from './SC-RESUMES-M1';
import { MissingFieldsModal } from './SC-EDITOR-M1';
import { completion, missingFields, newItem, newSection, warning, type Resume } from './model';
import { SaveQueue } from './SaveQueue';
import { ResumeRenderer } from './ResumeRenderer';

vi.mock('./resumeApi', () => ({
  resumeApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), save: vi.fn(), rename: vi.fn(),
    duplicate: vi.fn(), remove: vi.fn() },
  currentNickname: vi.fn(), logout: vi.fn(), uploadPhoto: vi.fn(),
}));
function fixture(): Resume {
  return {
    id: '20000000-0000-0000-0000-000000000001', title: '지원용', template: 'classic',
    style: { color: '#1F3A5F', font: 'pretendard', size: 'medium' }, updated_at: '2026-01-01T00:00:00Z',
    content: [
      { type: 'basics', hidden: false, data: {
        name: '지우', jobTitle: '개발자', email: 'jiwoo@resume.dev', phone: '', links: [], photoId: null,
      } },
      { type: 'summary', hidden: false, data: { headline: '', body: '소개' } },
      { type: 'experience', hidden: true, items: [{
        id: 'experience-one', company: '숨긴 회사', position: '', start: '', end: '2020.01', current: false,
        description: '',
      }] },
      { type: 'skills', hidden: false, data: { tags: ['Java', 'SQL', 'React'] } },
    ],
  };
}
function route(path: string) {
  const router = createMemoryRouter([
    ...resumeRoutes, { path: '/login', element: <p>로그인 화면</p> },
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(currentNickname).mockResolvedValue('지우');
  vi.mocked(resumeApi.list).mockResolvedValue([fixture()]);
  vi.mocked(resumeApi.get).mockResolvedValue(fixture());
  vi.mocked(resumeApi.save).mockResolvedValue(undefined);
  vi.mocked(resumeApi.rename).mockResolvedValue(undefined);
  vi.mocked(resumeApi.remove).mockResolvedValue(undefined);
  vi.mocked(logout).mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('SCR-RESUMES', () => {
  it('본인 API 카드와 닉네임을 표시하고 선택한 id의 편집기로 이동한다', async () => {
    const router = route('/resumes');
    await screen.findByText('지원용');
    expect(document.querySelector('.account')!).toHaveTextContent('지우');
    fireEvent.click(screen.getByRole('link', { name: '지원용 편집' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/resumes/${fixture().id}/edit`));
    await screen.findByLabelText('이름');
    expect(resumeApi.get).toHaveBeenCalledWith(fixture().id);
  });
  it('삭제 확인 취소는 요청하지 않으며 카드를 보존한다', async () => {
    route('/resumes');
    await screen.findByText('지원용');
    fireEvent.click(screen.getByRole('button', { name: '지원용 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(resumeApi.remove).not.toHaveBeenCalled();
    expect(screen.getByText('지원용')).toBeInTheDocument();
  });
  it('삭제 확인 성공 뒤 목록을 재조회한다', async () => {
    route('/resumes');
    await screen.findByText('지원용');
    fireEvent.click(screen.getByRole('button', { name: '지원용 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    const dialog = screen.getByRole('dialog', { name: '이력서를 삭제할까요?' });
    fireEvent.click(dialog.querySelector('button.danger')!);
    await waitFor(() => expect(resumeApi.remove).toHaveBeenCalledWith(fixture().id));
    await waitFor(() => expect(resumeApi.list).toHaveBeenCalledTimes(2));
  });
  it('목록 실패와 빈 성공을 구별한다', async () => {
    vi.mocked(resumeApi.list).mockRejectedValue(new Error('조회 실패'));
    route('/resumes');
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 실패');
    expect(screen.queryByText('아직 이력서가 없습니다. 새 이력서를 만들어보세요.')).not.toBeInTheDocument();
  });
  it('빈 목록에는 샘플 카드 대신 새 이력서 진입점만 제공한다', async () => {
    vi.mocked(resumeApi.list).mockResolvedValue([]);
    route('/resumes');
    await screen.findByText('아직 이력서가 없습니다. 새 이력서를 만들어보세요.');
    expect(screen.getAllByRole('button', { name: '＋ 새 이력서' })[0]).toBeInTheDocument();
    expect(screen.queryByText('지원용')).not.toBeInTheDocument();
  });
  it('SCR-RESUMES-M1 생성 후 응답의 실제 id로 이동한다', async () => {
    vi.mocked(resumeApi.create).mockResolvedValue({ id: fixture().id });
    const router = route('/resumes');
    await screen.findByText('지원용');
    fireEvent.click(screen.getAllByRole('button', { name: '＋ 새 이력서' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '생성' }));
    await waitFor(() => expect(resumeApi.create).toHaveBeenCalledWith('새 이력서', 'classic'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/resumes/${fixture().id}/edit`));
  });
  it('생성 modal 전송 중 재제출과 취소가 비활성이다', () => {
    render(<CreateResumeModal open pending onCancel={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });
});

describe('SCR-EDITOR', () => {
  it('입력은 미리보기/완성도에 즉시 반영되고 목록 이동 전 실제 snapshot을 저장한다', async () => {
    const router = route(`/resumes/${fixture().id}/edit`);
    const input = await screen.findByLabelText('이름');
    fireEvent.change(input, { target: { value: '변경된 이름' } });
    expect(screen.getByRole('button', { name: '변경됨' })).toBeInTheDocument();
    expect(screen.getAllByText('변경된 이름').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '← 목록' }));
    await waitFor(() => expect(resumeApi.save).toHaveBeenCalledOnce());
    expect(vi.mocked(resumeApi.save).mock.calls[0][1].content[0].data?.name).toBe('변경된 이름');
    await waitFor(() => expect(router.state.location.pathname).toBe('/resumes'));
  });
  it('저장 실패 시 이탈/iframe을 막고 같은 편집기에 유지한다', async () => {
    vi.mocked(resumeApi.save).mockRejectedValue(new Error('저장 실패'));
    const router = route(`/resumes/${fixture().id}/edit`);
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '새 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '← 목록' }));
    await screen.findByRole('button', { name: '저장 실패·다시 시도' });
    expect(router.state.location.pathname).toBe(`/resumes/${fixture().id}/edit`);
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('필수 누락 modal은 인쇄 없이 누락 필드로 focus한다', async () => {
    route(`/resumes/${fixture().id}/edit`);
    fireEvent.change(await screen.findByLabelText('희망 직무'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'PDF 내보내기' }));
    fireEvent.click(screen.getByRole('button', { name: '기본정보 · 희망 직무' }));
    await waitFor(() => expect(screen.getByLabelText('희망 직무')).toHaveFocus());
    expect(resumeApi.save).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('숨김은 입력만 보관하며 기본정보에는 숨김/삭제/이동 control이 없다', async () => {
    route(`/resumes/${fixture().id}/edit`);
    await screen.findByLabelText('이름');
    const basics = screen.getByRole('button', { name: /기본정보/ }).closest('section')!;
    expect(basics.textContent).not.toContain('섹션 삭제');
    expect(basics.querySelector('.drag-handle')).toBeNull();
    expect(document.querySelector('.resume-paper')!.textContent).not.toContain('숨긴 회사');
  });
  it('편집기 GET 실패는 임의 빈 이력서를 생성하지 않는다', async () => {
    vi.mocked(resumeApi.get).mockRejectedValue(new Error('이력서를 찾을 수 없습니다.'));
    route(`/resumes/${fixture().id}/edit`);
    expect(await screen.findByRole('alert')).toHaveTextContent('이력서를 찾을 수 없습니다.');
    expect(resumeApi.create).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('이름')).not.toBeInTheDocument();
  });
  it('dirty logout은 필수판정 없이 저장 성공 후에만 로그아웃한다', async () => {
    const router = route(`/resumes/${fixture().id}/edit`);
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(resumeApi.save).toHaveBeenCalledOnce();
    expect(vi.mocked(resumeApi.save).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(logout).mock.invocationCallOrder[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('완성도·구조 순수 함수', () => {
  it('숨김 필수와 가점은 제외하며 빈 항목 필수는 충족한다', () => {
    const resume = fixture();
    expect(missingFields(resume.content)).toEqual([]);
    expect(completion(resume.content).score).toBe(70);
    resume.content[2].hidden = false;
    expect(completion(resume.content).score).toBe(90);
    resume.content[2].items![0].company = '　 ';
    expect(completion(resume.content).score).toBe(40);
    resume.content[2].items = [];
    expect(completion(resume.content).score).toBe(70);
  });
  it('abc@와 Unicode 공백은 필수 미충족이지만 날짜는 warning일 뿐이다', () => {
    const resume = fixture();
    resume.content[0].data!.email = 'abc@'; resume.content[0].data!.jobTitle = '　';
    expect(missingFields(resume.content)).toHaveLength(2);
    expect(warning('end', '2020.01', { start: '2021.01' })).toContain('빠릅니다');
    expect(warning('start', 'wrong', {})).toContain('YYYY.MM');
  });
  it('완성도 기준별 가산/색상 및 photo 누락 helper를 제공한다', () => {
    const r = fixture();
    r.content[0].data!.jobTitle = ''; r.content[1].hidden = true; r.content[3].hidden = true;
    expect(completion(r.content)).toMatchObject({ score: 0, color: 'red' });
    r.content[0].data!.jobTitle = '개발자';
    expect(completion(r.content)).toMatchObject({ score: 50, color: 'orange' });
    r.content[2].hidden = false; r.content[3].hidden = false;
    expect(completion(r.content)).toMatchObject({ score: 80, color: 'green' });
    expect(completion(r.content).criteria.find(c => c.points === 10 && c.label.includes('사진'))?.met).toBe(false);
  });
  it('새 항목은 서로 다른 UUID와 타입별 빈값이며 섹션은 hidden=false이다', () => {
    expect(newItem('education').id).not.toBe(newItem('education').id);
    expect(newItem('education').current).toBe(false);
    expect(newSection('projects')).toEqual({ type: 'projects', hidden: false, items: [] });
  });
});

describe('SaveQueue', () => {
  it('1.5초 후 저장하고 요청 중 변경은 동시 요청 없이 최신값 한 번 저장한다', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    vi.mocked(resumeApi.save).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const queue = new SaveQueue(fixture().id, fixture(), vi.fn(), vi.fn());
    queue.change({ ...fixture(), title: '첫 변경' });
    await vi.advanceTimersByTimeAsync(1499);
    expect(resumeApi.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    queue.change({ ...fixture(), title: '최신 변경' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(resumeApi.save).toHaveBeenCalledOnce();
    finish();
    await vi.runAllTimersAsync();
    expect(resumeApi.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(resumeApi.save).mock.calls[1][1].title).toBe('최신 변경');
    expect(queue.state).toBe('저장됨'); queue.dispose();
  });
  it('저장 실패는 dirty 유지 후 명시 재시도로 성공한다', async () => {
    vi.mocked(resumeApi.save).mockRejectedValueOnce(new Error('실패'));
    const queue = new SaveQueue(fixture().id, fixture(), vi.fn(), vi.fn());
    queue.change({ ...fixture(), title: '변경' });
    await expect(queue.flush()).rejects.toThrow('실패');
    expect(queue.state).toBe('저장 실패·다시 시도');
    await queue.flush(); expect(queue.state).toBe('저장됨'); queue.dispose();
  });
  it('title PATCH는 이전 PUT 완료 뒤 실행하며 후속 PUT도 새 title을 보존한다', async () => {
    const queue = new SaveQueue(fixture().id, fixture(), vi.fn(), vi.fn());
    queue.change({ ...fixture(), title: '이전 제목' });
    await queue.rename('새 제목');
    expect(vi.mocked(resumeApi.save).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(resumeApi.rename).mock.invocationCallOrder[0]);
    queue.change({ ...queue.snapshot, template: 'modern' });
    await queue.flush();
    expect(vi.mocked(resumeApi.save).mock.calls[1][1].title).toBe('새 제목'); queue.dispose();
  });
});

it('SCR-PRINT 일반 탭에서는 자료 GET과 인쇄가 없다', () => {
  route(`/print/${fixture().id}`);
  expect(screen.getByRole('alert')).toHaveTextContent('PDF 내보내기');
  expect(resumeApi.get).not.toHaveBeenCalled();
});
it('SCR-EDITOR-M1 취소는 focus/저장 없이 닫기만 한다', () => {
  const close = vi.fn(); const focus = vi.fn();
  render(<MissingFieldsModal missing={[{ path: 'basics-name', label: '기본정보 · 이름' }]}
    onClose={close} onFocus={focus} />);
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(close).toHaveBeenCalledOnce(); expect(focus).not.toHaveBeenCalled();
});
it('세 출력은 동일 renderer이며 modern은 숨김 자료를 표시하지 않는다', async () => {
  const r = fixture(); r.template = 'modern';
  render(<ResumeRenderer resume={r} />);
  await waitFor(() => expect(document.querySelector('.resume-paper.modern')).not.toBeNull());
  expect(document.querySelector('.column-0')!.textContent).toContain('Java');
  expect(document.querySelector('.column-1')!.textContent).toContain('소개');
  expect(document.querySelector('.resume-paper')!.textContent).not.toContain('숨긴 회사');
});
