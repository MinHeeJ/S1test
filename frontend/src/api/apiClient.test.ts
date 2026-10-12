import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeWrite } from '../pages/resumes/model';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, meta: {}, data }), {
    status, headers: { 'X-CSRF-TOKEN': 'session-token' },
  });
}
const write: ResumeWrite = {
  title: '입력 중', template: 'classic',
  style: { color: '#1F3A5F', font: 'pretendard', size: 'medium' },
  content: [{ type: 'basics', hidden: false, data: {
    name: '', jobTitle: '', email: 'abc@', phone: '', links: [], photoId: null,
  } }],
};

describe('공유 API registry의 실제 feature client', () => {
  it('인증과 공통 전송은 기존 export를 그대로 사용한다', async () => {
    const registry = await import('./apiClient');
    const auth = await import('../pages/auth/authApi');
    const shared = await import('../shared/api');
    expect(registry.apiRequest).toBe(shared.apiRequest);
    expect(registry.configureApi).toBe(shared.configureApi);
    expect(registry.ApiError).toBe(shared.ApiError);
    expect(registry.getCurrentUser).toBe(auth.getCurrentUser);
    expect(registry.login).toBe(auth.login);
    expect(registry.signup).toBe(auth.signup);
    expect(registry.logout).toBe(auth.logout);
  });

  it('목록·조회는 envelope의 실제 data와 선택 id를 사용한다', async () => {
    const row = { ...write, id: 'selected/id', updated_at: '2026-01-01T00:00:00Z' };
    const request = vi.fn().mockResolvedValueOnce(json([row])).mockResolvedValueOnce(json(row));
    vi.stubGlobal('fetch', request);
    const { resumeApi } = await import('./apiClient');
    expect(await resumeApi.list()).toEqual([row]);
    expect(await resumeApi.get(row.id)).toEqual(row);
    expect(request.mock.calls.map(call => call[0])).toEqual(['/api/resumes', '/api/resumes/selected%2Fid']);
    expect(request.mock.calls[1][1].credentials).toBe('same-origin');
  });

  it('생성·복제는201의 id를 반환하고 저장·이름변경·삭제204는 본문을 읽지 않는다', async () => {
    const request = vi.fn().mockResolvedValueOnce(json({ nickname: '지우' }))
      .mockResolvedValueOnce(json({ id: 'created-id' }, 201))
      .mockResolvedValueOnce(json({ id: 'copied-id' }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const { resumeApi } = await import('./apiClient');
    expect(await resumeApi.create('작성 중', 'modern')).toEqual({ id: 'created-id' });
    expect(await resumeApi.duplicate('selected/id')).toEqual({ id: 'copied-id' });
    expect(await resumeApi.save('selected/id', write)).toBeUndefined();
    expect(await resumeApi.rename('selected/id', ' 새 제목 ')).toBeUndefined();
    expect(await resumeApi.remove('selected/id')).toBeUndefined();
    expect(request.mock.calls.map(call => [call[0], call[1]?.method ?? 'GET'])).toEqual([
      ['/api/auth/me', 'GET'], ['/api/resumes', 'POST'], ['/api/resumes/selected%2Fid/duplicate', 'POST'],
      ['/api/resumes/selected%2Fid', 'PUT'], ['/api/resumes/selected%2Fid', 'PATCH'],
      ['/api/resumes/selected%2Fid', 'DELETE'],
    ]);
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ title: '작성 중', template: 'modern' });
    expect(JSON.parse(request.mock.calls[3][1].body)).toEqual(write);
    expect(JSON.parse(request.mock.calls[4][1].body)).toEqual({ title: ' 새 제목 ' });
    for (const [, init] of request.mock.calls.slice(1)) {
      expect(init.headers.get('X-CSRF-TOKEN')).toBe('session-token');
      expect(init.credentials).toBe('same-origin');
    }
  });

  it('사진 client는 multipart file과201 photoId 및 원본 binary를 보존한다', async () => {
    const file = new File(['image-bytes'], 'portrait.png', { type: 'image/png' });
    const photoId = 'b0000000-0000-0000-0000-000000000001';
    const request = vi.fn().mockResolvedValueOnce(json({ nickname: '지우' }))
      .mockResolvedValueOnce(json({ photoId }, 201))
      .mockResolvedValueOnce(new Response('image-bytes', { headers: { 'Content-Type': 'image/png' } }));
    vi.stubGlobal('fetch', request);
    const { uploadPhoto, getPhoto, photoUrl } = await import('./apiClient');
    expect(await uploadPhoto(file)).toEqual({ photoId });
    const blob = await getPhoto(photoId);
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('image-bytes');
    expect(photoUrl(photoId)).toBe(`/api/photos/${photoId}`);
    expect(request.mock.calls[1][0]).toBe('/api/photos');
    expect(request.mock.calls[1][1].body.get('file')).toBe(file);
    expect(request.mock.calls[1][1].headers.has('Content-Type')).toBe(false);
    expect(request.mock.calls[2][0]).toBe(photoUrl(photoId));
  });

  it('공통 전송의401은 설정된 로그인 이동을 호출하고404는 그대로 유지한다', async () => {
    const error = { success: false, meta: {}, code: 'DENIED', message: '조회 실패', field: null };
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(error), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(error), { status: 404 }));
    vi.stubGlobal('fetch', request);
    const { resumeApi, configureApi } = await import('./apiClient');
    const unauthorized = vi.fn();
    configureApi({ onUnauthorized: unauthorized });
    await expect(resumeApi.list()).rejects.toMatchObject({ status: 401, body: error });
    expect(unauthorized).toHaveBeenCalledOnce();
    await expect(resumeApi.get('missing')).rejects.toMatchObject({ status: 404, body: error });
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
