import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionFields } from './SectionFields';
import { newItem, type Section } from './model';
import { uploadPhoto } from './resumeApi';

vi.mock('./resumeApi', () => ({ uploadPhoto: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
function Fields({ initial, error = vi.fn() }: { initial: Section; error?: (message: string) => void }) {
  const [section, setSection] = useState(initial);
  const [item, setItem] = useState<string | null>(String(initial.items?.[0]?.id ?? ''));
  return (
    <>
      <SectionFields section={section} activeItem={item} onActiveItem={setItem} onChange={setSection} onError={error} />
      <output aria-label="저장 내용">{JSON.stringify(section)}</output>
    </>
  );
}
const readback = () => JSON.parse(screen.getByLabelText('저장 내용').textContent!) as Section;

describe('항목 편집', () => {
  it('current 토글은 종료일 보존·활성 전환이며 잘못된 날짜도 문자열로 보존한다', () => {
    const item = { ...newItem('experience'), company: '회사', end: '2020.01' };
    render(<Fields initial={{ type: 'experience', hidden: false, items: [item] }} />);
    fireEvent.click(screen.getByLabelText('재직중'));
    expect(screen.getByLabelText('종료일')).toBeDisabled();
    expect(readback().items![0].end).toBe('2020.01');
    fireEvent.click(screen.getByLabelText('재직중'));
    expect(screen.getByLabelText('종료일')).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: 'bad date' } });
    expect(readback().items![0].start).toBe('bad date');
    expect(screen.getByText('YYYY.MM 형식을 확인하세요.')).toBeInTheDocument();
  });
  it('Enter는 설명 다음 줄에 - 를 삽입하며 항목 삭제는 모달 없이 즉시 제거한다', () => {
    const item = { ...newItem('projects'), name: '프로젝트', description: '첫 줄' };
    render(<Fields initial={{ type: 'projects', hidden: false, items: [item] }} />);
    const input = screen.getByLabelText('설명') as HTMLTextAreaElement;
    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(readback().items![0].description).toBe('첫 줄\n- ');
    fireEvent.click(screen.getByRole('button', { name: '항목 삭제' }));
    expect(readback().items).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('복제는 새 UUID와 동일값을 추가하며 20개면 추가/복제를 비활성한다', () => {
    const item = { ...newItem('languages'), language: '영어', test: '시험', score: '점수' };
    const view = render(<Fields initial={{ type: 'languages', hidden: false, items: [item] }} />);
    fireEvent.click(screen.getByRole('button', { name: '항목 복제' }));
    const items = readback().items!;
    expect(items).toHaveLength(2); expect(items[0].id).not.toBe(items[1].id);
    expect(items[1].language).toBe('영어');
    view.unmount();
    render(<Fields initial={{ type: 'languages', hidden: false,
      items: Array.from({ length: 20 }, () => newItem('languages')) }} />);
    expect(screen.getByRole('button', { name: '어학 항목 추가' })).toBeDisabled();
    screen.getAllByRole('button', { name: '항목 복제' }).forEach(button => expect(button).toBeDisabled());
  });
  it('summary body 글자 수는 Unicode codepoints와 newline 각각 1이다', () => {
    render(<Fields initial={{ type: 'summary', hidden: false, data: { headline: '', body: '😀\n가' } }} />);
    expect(screen.getByText('3자')).toBeInTheDocument();
  });
});

it('태그 입력 중복은 추가하지 않고 Enter/쉼표와 제거를 처리한다', () => {
  render(<Fields initial={{ type: 'skills', hidden: false, data: { tags: ['Java'] } }} />);
  const input = screen.getByLabelText('기술 태그');
  fireEvent.change(input, { target: { value: 'Java' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(readback().data!.tags).toEqual(['Java']);
  fireEvent.change(input, { target: { value: 'SQL' } }); fireEvent.keyDown(input, { key: ',' });
  expect(readback().data!.tags).toEqual(['Java', 'SQL']);
  fireEvent.click(screen.getByRole('button', { name: 'Java ×' }));
  expect(readback().data!.tags).toEqual(['SQL']);
});
it('links 3개에서 추가가 비활성이고 제거는 연결 배열만 변경한다', () => {
  render(<Fields initial={{ type: 'basics', hidden: false, data: {
    name: '', jobTitle: '', email: '', phone: '', photoId: null,
    links: Array.from({ length: 3 }, () => ({ label: '', url: '' })),
  } }} />);
  expect(screen.getByRole('button', { name: '링크 추가' })).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: '링크 제거' })[0]);
  expect(readback().data!.links).toHaveLength(2);
});
it('사진 실패는 기존 연결을 보존하고 제거는 photo DELETE 없이 null만 설정한다', async () => {
  vi.mocked(uploadPhoto).mockRejectedValue(new Error('업로드 실패'));
  const error = vi.fn();
  render(<Fields error={error} initial={{ type: 'basics', hidden: false, data: {
    name: '', jobTitle: '', email: '', phone: '', photoId: 'existing-photo', links: [],
  } }} />);
  fireEvent.change(screen.getByLabelText('사진 등록·변경 (JPG·PNG, 2MB 이하)'), {
    target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(error).toHaveBeenCalledWith('업로드 실패'));
  expect(readback().data!.photoId).toBe('existing-photo');
  fireEvent.click(screen.getByRole('button', { name: '사진 제거' }));
  expect(readback().data!.photoId).toBeNull();
});
