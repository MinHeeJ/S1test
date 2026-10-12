import { apiRequest, type ApiResponse } from '../../shared/api';
import type { Resume, ResumeWrite } from './model';
const target = (id: string) => `/api/resumes/${encodeURIComponent(id)}`;
export const resumeApi = {
  async list() { return (await apiRequest<ApiResponse<Resume[]>>('/api/resumes')).data; },
  async get(id: string) { return (await apiRequest<ApiResponse<Resume>>(target(id))).data; },
  async create(title: string, template: Resume['template']) {
    return (await apiRequest<ApiResponse<{ id: string }>>('/api/resumes', {
      method: 'POST', body: JSON.stringify({ title, template }),
    })).data;
  },
  save(id: string, data: ResumeWrite) {
    return apiRequest<void>(target(id), { method: 'PUT', body: JSON.stringify(data) });
  },
  rename(id: string, title: string) {
    return apiRequest<void>(target(id), { method: 'PATCH', body: JSON.stringify({ title }) });
  },
  async duplicate(id: string) {
    return (await apiRequest<ApiResponse<{ id: string }>>(`${target(id)}/duplicate`, { method: 'POST' })).data;
  },
  remove(id: string) { return apiRequest<void>(target(id), { method: 'DELETE' }); },
};
export async function currentNickname() {
  const { data } = await apiRequest<ApiResponse<{ nickname: string }>>('/api/auth/me');
  if (typeof data.nickname !== 'string') throw new Error('사용자 응답이 올바르지 않습니다.');
  return data.nickname;
}
export const logout = () => apiRequest<void>('/api/auth/logout', { method: 'POST' });
export async function uploadPhoto(file: File) {
  const body = new FormData();
  body.append('file', file);
  return (await apiRequest<ApiResponse<{ photoId: string }>>('/api/photos', { method: 'POST', body })).data.photoId;
}
