import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PhotoEditor } from './PhotoEditor';
import { PhotoImage } from './PhotoImage';
import { getPhoto, uploadPhoto } from './photoApi';
import { configureApi } from '../../shared/api';

const originalId = '00000000-0000-4000-8000-000000000001';
const replacementId = '00000000-0000-4000-8000-000000000002';
const request = vi.fn();
const redirect = vi.fn();
const createUrl = vi.fn(() => 'blob:portrait');
const revokeUrl = vi.fn();

beforeEach(() => {
  request.mockReset();
  redirect.mockReset();
  createUrl.mockClear();
  revokeUrl.mockClear();
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: createUrl,
    revokeObjectURL: revokeUrl,
  }));
  configureApi({ onUnauthorized: redirect, onError: () => {} });
  request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/me') {
      return new Response('{}', { headers: { 'X-CSRF-TOKEN': 'photo-token' } });
    }
    if (init?.method === 'POST') {
      return new Response(JSON.stringify({ success: true, meta: {}, data: { photoId: replacementId } }), {
        status: 201,
      });
    }
    return new Response('original bytes', {
      headers: { 'Content-Type': 'image/png' },
    });
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function ParentEditor({ initial = originalId }: { initial?: string | null }) {
  const [photoId, setPhotoId] = useState<string | null>(initial);
  return <PhotoEditor photoId={photoId} onPhotoIdChange={setPhotoId} />;
}

function select(type = 'image/jpeg', bytes = 'file') {
  fireEvent.change(screen.getByLabelText('사진 파일'), {
    target: { files: [new File([bytes], 'portrait.jpg', { type })] },
  });
}

function posts() {
  return request.mock.calls.filter(([, init]) => init?.method === 'POST');
}

function errorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ success: false, meta: {}, code, message, field: 'file' }), { status });
}

describe('편집기 사진 영역', () => {
  it('사진 없는 상태에서는 조회하지 않고 파일 선택 취소는 변경하지 않는다', () => {
    const change = vi.fn();
    render(<PhotoEditor photoId={null} onPhotoIdChange={change} />);
    expect(screen.getByRole('button', { name: '사진 등록' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('사진 파일'), { target: { files: [] } });
    expect(request).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('선택 즉시 multipart 업로드하고 부모의 직렬 저장에 연결값 하나를 전달한다', async () => {
    const change = vi.fn();
    render(<PhotoEditor photoId={null} onPhotoIdChange={change} />);
    select();
    await waitFor(() => expect(change).toHaveBeenCalledWith(replacementId));
    expect(posts()).toHaveLength(1);
    const [path, init] = posts()[0];
    expect(path).toBe('/api/photos');
    expect(init.body.get('file')).toBeInstanceOf(File);
    expect(init.headers.has('Content-Type')).toBe(false);
    expect(init.headers.get('X-CSRF-TOKEN')).toBe('photo-token');
    expect(init.credentials).toBe('same-origin');
    expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('연결하여 저장');
  });

  it('기존 사진 변경 후 부모 상태와 같은 새 photoId 원본을 표시한다', async () => {
    render(<ParentEditor />);
    await screen.findByRole('img');
    select('image/png');
    await waitFor(() => expect(request.mock.calls.map(([path]) => path)).toContain(`/api/photos/${replacementId}`));
    await screen.findByRole('img');
    expect(posts()).toHaveLength(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:portrait');
  });

  it.each([
    [400, 'UNSUPPORTED_FILE_TYPE', 'JPG 또는 PNG 사진을 선택해주세요.'],
    [413, 'FILE_TOO_LARGE', '사진은 2MB 이하만 업로드할 수 있습니다.'],
  ])('업로드 %i 오류는 이전 사진·연결을 유지하고 토스트로 표시한다', async (status, code, message) => {
    const change = vi.fn();
    render(<PhotoEditor photoId={originalId} onPhotoIdChange={change} />);
    const before = await screen.findByRole('img');
    request.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/auth/me') return new Response('{}', { headers: { 'X-CSRF-TOKEN': 'photo-token' } });
      if (init?.method === 'POST') return errorResponse(status, code, message);
      return new Response('original', {
        headers: { 'Content-Type': 'image/png' },
      });
    });
    select();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(message));
    expect(screen.getByRole('img')).toBe(before);
    expect(change).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(1);
  });

  it('진행 중 중복 업로드와 삭제를 막고 기존 사진을 남긴다', async () => {
    render(<ParentEditor />);
    await screen.findByRole('img');
    let finish!: (value: Response) => void;
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/auth/me') {
        return Promise.resolve(new Response('{}', { headers: { 'X-CSRF-TOKEN': 'photo-token' } }));
      }
      if (init?.method === 'POST') return new Promise<Response>(resolve => { finish = resolve; });
      return Promise.resolve(new Response('original', {
        headers: { 'Content-Type': 'image/png' },
      }));
    });
    select();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '변경' })).toBeDisabled();
    expect(screen.getByRole('img')).toBeInTheDocument();
    select();
    expect(posts()).toHaveLength(1);
    await act(async () => finish(errorResponse(400, 'UNSUPPORTED_FILE_TYPE', '잘못된 사진')));
  });

  it('삭제는 즉시 null을 전달하여 이미지만 숨기고 서버 DELETE를 보내지 않는다', async () => {
    render(<ParentEditor />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 등록' })).toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  });

  it('읽기 전용·초기 이력서 오류 상태에서 변경을 요청할 수 없다', () => {
    const change = vi.fn();
    render(<PhotoEditor photoId={null} disabled onPhotoIdChange={change} />);
    expect(screen.getByRole('button', { name: '사진 등록' })).toBeDisabled();
    select();
    expect(request).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('토스트는 3초 후 사라지며 업로드 실패는 자동 재전송하지 않는다', async () => {
    render(<PhotoEditor photoId={null} onPhotoIdChange={vi.fn()} />);
    request.mockImplementation(async (path: string) => path === '/api/auth/me'
      ? new Response('{}', { headers: { 'X-CSRF-TOKEN': 'photo-token' } })
      : errorResponse(400, 'UNSUPPORTED_FILE_TYPE', '지원하지 않는 사진'));
    vi.useFakeTimers();
    await act(async () => { select(); });
    expect(screen.getByRole('status')).toHaveTextContent('지원하지 않는 사진');
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });
});

describe('공용 사진 렌더', () => {
  it('저장된 ID로 원본을 읽어 편집기·A4 공용 3:4 cover로 표시한다', async () => {
    const ready = vi.fn();
    const view = render(<PhotoImage photoId={originalId} onReady={ready} />);
    expect(screen.getByRole('status')).toHaveTextContent('사진 불러오는 중');
    const image = await screen.findByRole('img');
    expect(image).toHaveStyle({ aspectRatio: '3 / 4', objectFit: 'cover' });
    expect(request).toHaveBeenCalledWith(`/api/photos/${originalId}`, expect.objectContaining({
      credentials: 'same-origin',
    }));
    fireEvent.load(image);
    expect(ready).toHaveBeenCalledOnce();
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:portrait');
  });

  it('타인 사진 404는 비노출·오류 상태이며 인쇄 준비 완료를 알리지 않는다', async () => {
    request.mockResolvedValue(errorResponse(404, 'NOT_FOUND', '사진을 찾을 수 없습니다.'));
    const ready = vi.fn();
    const failed = vi.fn();
    render(<PhotoImage photoId={originalId} onReady={ready} onError={failed} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('사진을 찾을 수 없습니다.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
  });

  it('사진 401은 기존 공용 API 로그인 이동 흐름을 따른다', async () => {
    request.mockResolvedValue(errorResponse(401, 'UNAUTHENTICATED', '로그인이 필요합니다.'));
    render(<PhotoImage photoId={originalId} />);
    await screen.findByRole('alert');
    expect(redirect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('이미지 decode 실패는 출력 완료를 알리지 않고 오류를 부모에 전달한다', async () => {
    const ready = vi.fn();
    const failed = vi.fn();
    render(<PhotoImage photoId={originalId} onReady={ready} onError={failed} />);
    fireEvent.error(await screen.findByRole('img'));
    expect(await screen.findByRole('alert')).toHaveTextContent('사진을 표시하지 못했습니다.');
    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledOnce();
  });

  it('null은 바이너리 요청도 이미지 출력도 하지 않는다', () => {
    render(<PhotoImage photoId={null} />);
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('사진 클라이언트는 raw blob을 반환하고 업로드 envelope의 실제 id를 반환한다', async () => {
    const blob = await getPhoto(originalId);
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('original bytes');
    const uploaded = await uploadPhoto(new File(['original'], 'portrait.png', { type: 'image/png' }));
    expect(uploaded.photoId).toBe(replacementId);
  });
});
