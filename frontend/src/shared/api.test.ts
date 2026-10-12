import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

const error = { success: false, meta: {}, code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.', field: null };

describe('세션 API 경계', () => {
  it('초기 401 me의 토큰을 같은 세션의 쓰기에 전달하고 204 본문을 읽지 않는다', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(error), { status: 401, headers: { 'X-CSRF-TOKEN': 'test' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const { apiRequest } = await import('./api');
    expect(await apiRequest('/api/auth/login', { method: 'POST', body: '{}' })).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe('/api/auth/me');
    expect(request.mock.calls[1][1].headers.get('X-CSRF-TOKEN')).toBe('test');
    expect(request.mock.calls[1][1].credentials).toBe('same-origin');
  });

  it('보호 조회의 401은 로그인 이동과 토스트를 요청한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(error), { status: 401 })));
    const { apiRequest, configureApi } = await import('./api');
    const redirect = vi.fn();
    const toast = vi.fn();
    configureApi({ onUnauthorized: redirect, onError: toast });
    await expect(apiRequest('/api/resumes')).rejects.toMatchObject({ status: 401, body: error });
    expect(redirect).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(error.message);
  });

  it('실패한 비멱등 POST를 자동으로 재전송하지 않는다', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { headers: { 'X-CSRF-TOKEN': 'test' } }))
      .mockRejectedValueOnce(new TypeError('network'));
    vi.stubGlobal('fetch', request);
    const { apiRequest } = await import('./api');
    await expect(apiRequest('/api/resumes', { method: 'POST', body: '{}' })).rejects.toThrow('network');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('절대 URL은 네트워크 호출 전에 거부한다', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const { apiRequest } = await import('./api');
    await expect(apiRequest('https://example.test/api/resumes')).rejects.toThrow('상대');
    expect(request).not.toHaveBeenCalled();
  });
});
