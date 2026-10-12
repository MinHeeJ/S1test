import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function anonymous(token: string) {
  return new Response(JSON.stringify({
    success: false, meta: {}, code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.', field: null,
  }), { status: 401, headers: { 'X-CSRF-TOKEN': token } });
}

function identity() {
  return new Response(JSON.stringify({ success: true, meta: {}, data: { nickname: '지우' } }), {
    headers: { 'X-CSRF-TOKEN': 'rotated-token' },
  });
}

describe('인증 API 실제 상대 요청', () => {
  it('login은 초기401 토큰을 보내고 204를 읽지 않으며 me에서 nickname을 받는다', async () => {
    const request = vi.fn().mockResolvedValueOnce(anonymous('initial-token'))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(identity());
    vi.stubGlobal('fetch', request);
    const { login, getCurrentUser } = await import('./authApi');
    await login({ email: 'jiwoo@resume.dev', password: 'demo1234' });
    expect(await getCurrentUser()).toEqual({ nickname: '지우' });
    expect(request.mock.calls.map(call => call[0])).toEqual(['/api/auth/me', '/api/auth/login', '/api/auth/me']);
    expect(request.mock.calls[1][1].headers.get('X-CSRF-TOKEN')).toBe('initial-token');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ email: 'jiwoo@resume.dev', password: 'demo1234' });
    expect(request.mock.calls[1][1].credentials).toBe('same-origin');
  });

  it('signup은 계약 세 필드만 전송하고 204 뒤 회전한 토큰을 다시 취득한다', async () => {
    const request = vi.fn().mockResolvedValueOnce(anonymous('initial-token'))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(identity())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const { signup, getCurrentUser, logout } = await import('./authApi');
    const body = { email: 'new@example.test', nickname: '새사용자', password: 'password123' };
    await signup(body);
    await getCurrentUser();
    await logout();
    expect(request.mock.calls[1][0]).toBe('/api/auth/signup');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(body);
    expect(request.mock.calls[3][0]).toBe('/api/auth/logout');
    expect(request.mock.calls[3][1].body).toBeUndefined();
    expect(request.mock.calls[3][1].headers.get('X-CSRF-TOKEN')).toBe('rotated-token');
  });

  it('nickname 부재는 계약 오류로 처리하고 가상 사용자를 반환하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, meta: {}, data: {} })),
    ));
    const { getCurrentUser } = await import('./authApi');
    await expect(getCurrentUser()).rejects.toThrow('현재 사용자 응답');
  });

  it('logout은 flush 성공 이후에만 전송되며 이후 me는401이다', async () => {
    const request = vi.fn().mockResolvedValueOnce(identity()).mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(anonymous('after-logout-token'));
    vi.stubGlobal('fetch', request);
    const { getCurrentUser, logout } = await import('./authApi');
    await getCurrentUser();
    let finish!: () => void;
    const flush = vi.fn(() => new Promise<void>(done => { finish = done; }));
    const pending = logout(flush);
    expect(request).toHaveBeenCalledOnce();
    finish();
    await pending;
    expect(request.mock.calls[1][0]).toBe('/api/auth/logout');
    await expect(getCurrentUser()).rejects.toMatchObject({ status: 401 });
  });

  it('logout 직전 저장 실패는 logout 호출을 막아 세션과 편집기를 유지한다', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const { logout } = await import('./authApi');
    await expect(logout(async () => { throw new Error('저장 실패'); })).rejects.toThrow('저장 실패');
    expect(request).not.toHaveBeenCalled();
  });

  it('login 네트워크 실패는 비멱등 POST를 자동 재시도하지 않는다', async () => {
    const request = vi.fn().mockResolvedValueOnce(anonymous('initial-token')).mockRejectedValueOnce(new Error('전송 실패'));
    vi.stubGlobal('fetch', request);
    const { login } = await import('./authApi');
    await expect(login({ email: 'jiwoo@resume.dev', password: 'demo1234' })).rejects.toThrow('전송 실패');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
