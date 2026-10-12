export const sectionNames = {
  basics: '기본정보', summary: '자기소개', experience: '경력', education: '학력',
  skills: '기술스택', projects: '프로젝트', certificates: '자격증', languages: '어학',
} as const;
export type SectionType = keyof typeof sectionNames;
export type Value = string | boolean | null | string[] | Link[];
export interface Link { label: string; url: string }
export interface Section {
  type: SectionType;
  hidden: boolean;
  data?: Record<string, Value>;
  items?: Record<string, string | boolean>[];
}
export interface Resume {
  id: string;
  title: string;
  template: 'classic' | 'modern';
  style: { color: string; font: 'pretendard' | 'noto-serif-kr'; size: 'small' | 'medium' | 'large' };
  content: Section[];
  updated_at: string;
}
export type ResumeWrite = Pick<Resume, 'title' | 'template' | 'style' | 'content'>;
export const itemFields: Partial<Record<SectionType, string[]>> = {
  experience: ['company', 'position', 'start', 'end', 'current', 'description'],
  education: ['school', 'major', 'degree', 'start', 'end', 'current'],
  projects: ['name', 'role', 'start', 'end', 'description', 'url'],
  certificates: ['name', 'issuer', 'date'], languages: ['language', 'test', 'score'],
};
export const labels: Record<string, string> = {
  name: '이름', jobTitle: '희망 직무', email: '이메일', phone: '전화번호', headline: '헤드라인', body: '본문',
  company: '회사명', position: '직책', start: '시작일', end: '종료일', current: '현재', description: '설명',
  school: '학교명', major: '전공', degree: '학위', role: '역할', url: 'URL', issuer: '발급기관', date: '취득일',
  language: '언어', test: '시험', score: '점수',
};
export function newSection(type: SectionType): Section {
  if (type === 'summary') return { type, hidden: false, data: { headline: '', body: '' } };
  if (type === 'skills') return { type, hidden: false, data: { tags: [] } };
  return { type, hidden: false, items: [] };
}
export function newItem(type: SectionType) {
  return Object.fromEntries([
    ['id', crypto.randomUUID()], ...(itemFields[type] ?? []).map(field => [field, field === 'current' ? false : '']),
  ]) as Record<string, string | boolean>;
}
export const present = (value: unknown) => typeof value === 'string' && value.replace(/\s/gu, '').length > 0;
export const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export interface Missing { path: string; label: string }
export function missingFields(content: Section[]): Missing[] {
  const missing: Missing[] = [];
  content.forEach(section => {
    if (section.hidden) return;
    if (section.type === 'basics') {
      ['name', 'jobTitle', 'email'].forEach(field => {
        const value = String(section.data?.[field] ?? '');
        if (!present(value) || (field === 'email' && !emailValid(value))) {
          missing.push({ path: `basics-${field}`, label: `기본정보 · ${labels[field]}` });
        }
      });
    }
    const first = itemFields[section.type]?.[0];
    if (first) section.items?.forEach((item, index) => {
      if (!present(item[first])) missing.push({
        path: `${section.type}-${item.id}-${first}`,
        label: `${sectionNames[section.type]} ${index + 1} · ${labels[first]}`,
      });
    });
  });
  return missing;
}
export function completion(content: Section[]) {
  const visible = content.filter(section => !section.hidden);
  const find = (type: SectionType) => visible.find(section => section.type === type);
  const criteria = [
    { met: missingFields(content).length === 0, points: 50, label: '필수 항목을 입력하세요 (+50%)' },
    { met: present(find('summary')?.data?.body), points: 10, label: '자기소개를 작성하세요 (+10%)' },
    { met: visible.some(s => ['experience', 'projects'].includes(s.type) && !!s.items?.length),
      points: 20, label: '경력 또는 프로젝트를 추가하세요 (+20%)' },
    { met: ((find('skills')?.data?.tags as string[] | undefined)?.length ?? 0) >= 3,
      points: 10, label: '기술 태그를 3개 이상 추가하세요 (+10%)' },
    { met: present(find('basics')?.data?.photoId), points: 10, label: '사진을 등록하세요 (+10%)' },
  ];
  const score = criteria.reduce((sum, c) => sum + (c.met ? c.points : 0), 0);
  return { score, criteria, color: score < 50 ? 'red' : score < 80 ? 'orange' : 'green' };
}
export function warning(field: string, value: string, row: Record<string, Value>) {
  if (field === 'email' && value && !emailValid(value)) return '이메일 형식을 확인하세요.';
  if (['start', 'end', 'date'].includes(field) && value && !/^\d{4}\.(0[1-9]|1[0-2])$/.test(value)) {
    return 'YYYY.MM 형식을 확인하세요.';
  }
  if (field === 'end' && !row.current && value && row.start && value < String(row.start)) {
    return '종료일이 시작일보다 빠릅니다.';
  }
  return null;
}
