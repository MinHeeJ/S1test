import { apiRequest, type ApiResponse } from '../../shared/api';

export interface CurrentUser { nickname: string }
export interface LoginRequest { email: string; password: string }
export interface SignupRequest extends LoginRequest { nickname: string }

/** Reads the server identity; missing nickname is a contract failure, not a fallback name. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await apiRequest<ApiResponse<CurrentUser>>('/api/auth/me');
  if (response.success !== true || !response.meta || typeof response.data?.nickname !== 'string') {
    throw new Error('현재 사용자 응답을 확인하지 못했습니다.');
  }
  return response.data;
}

export function login(body: LoginRequest): Promise<void> {
  return apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

export function signup(body: SignupRequest): Promise<void> {
  return apiRequest('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) });
}

/** Editor callers supply their serialized flush; a failure must keep the authenticated editor open. */
export async function logout(flush?: () => Promise<void>): Promise<void> {
  if (flush) await flush();
  await apiRequest('/api/auth/logout', { method: 'POST' });
}
