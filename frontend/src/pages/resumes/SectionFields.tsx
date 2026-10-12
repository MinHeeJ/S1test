import { useState } from 'react';
import { itemFields, labels, newItem, sectionNames, warning, type Section, type Value, type Link } from './model';
import { ResumeSortableList } from './ResumeSortableList';
import { uploadPhoto } from './resumeApi';

export function SectionFields({ section, activeItem, onActiveItem, onChange, onError }: {
  section: Section; activeItem: string | null; onActiveItem: (id: string | null) => void;
  onChange: (section: Section) => void; onError: (error: string) => void;
}) {
  const [tag, setTag] = useState('');
  const [uploading, setUploading] = useState(false);
  function field(key: string, row: Record<string, Value>, prefix: string, update: (key: string, value: Value) => void) {
    const id = `${prefix}-${key}`;
    const value = String(row[key] ?? '');
    const error = warning(key, value, row);
    if (key === 'current') return (
      <label key={key} className="checkbox-field">
        <input type="checkbox" checked={!!row.current} onChange={e => update(key, e.target.checked)} />
        {section.type === 'education' ? '재학중' : '재직중'}
      </label>
    );
    if (key === 'degree') return (
      <label key={key}>학위
        <select id={id} value={value} onChange={e => update(key, e.target.value)}>
          {['', '고졸', '학사', '석사', '박사'].map(degree => <option key={degree} value={degree}>{degree || '선택'}</option>)}
        </select>
      </label>
    );
    return (
      <label key={key} className="field-group">
        {labels[key] ?? key}
        {['body', 'description'].includes(key) ? (
          <textarea
            id={id}
            value={value}
            onChange={e => update(key, e.target.value)}
            onKeyDown={e => {
              if (key === 'description' && e.key === 'Enter') {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                update(key, `${value.slice(0, start)}\n- ${value.slice(end)}`);
                requestAnimationFrame(() => {
                  const input = document.getElementById(id) as HTMLTextAreaElement | null;
                  input?.setSelectionRange(start + 3, start + 3);
                });
              }
            }}
          />
        ) : (
          <input
            id={id}
            value={value}
            disabled={key === 'end' && !!row.current}
            aria-invalid={!!error}
            placeholder={['start', 'end', 'date'].includes(key) ? 'YYYY.MM' : undefined}
            onChange={e => update(key, e.target.value)}
          />
        )}
        {key === 'body' && <small>{Array.from(value).length}자</small>}
        {error && <small className="field-warning">{error}</small>}
      </label>
    );
  }
  const data = section.data ?? {};
  const updateData = (key: string, value: Value) => onChange({ ...section, data: { ...data, [key]: value } });
  function addTag() {
    const tags = data.tags as string[];
    const value = tag;
    if (value && tags.length < 30 && !tags.includes(value)) updateData('tags', [...tags, value]);
    setTag('');
  }
  if (section.type === 'skills') return (
    <div>
      <div className="tag-list">
        {(data.tags as string[]).map(value => (
          <button key={value} onClick={() => updateData('tags', (data.tags as string[]).filter(t => t !== value))}>
            {value} ×
          </button>
        ))}
      </div>
      <label>기술 태그
        <input
          value={tag}
          disabled={(data.tags as string[]).length >= 30}
          onChange={e => setTag(e.target.value)}
          onKeyDown={e => { if (['Enter', ','].includes(e.key)) { e.preventDefault(); addTag(); } }}
        />
      </label>
      <small>Enter 또는 쉼표로 추가 · 최대 30개</small>
    </div>
  );
  if (section.type === 'basics' || section.type === 'summary') return (
    <div className="section-fields">
      {(section.type === 'basics' ? ['name', 'jobTitle', 'email', 'phone'] : ['headline', 'body'])
        .map(key => field(key, data, section.type, updateData))}
      {section.type === 'basics' && (
        <>
          <div className="links-fields">
            {(data.links as Link[]).map((link, index) => (
              <div key={index}>
                {(['label', 'url'] as const).map(key => (
                  <label key={key}>{key === 'label' ? '링크 이름' : '링크 URL'}
                    <input value={link[key]} onChange={e => updateData('links', (data.links as Link[]).map((l, i) =>
                      i === index ? { ...l, [key]: e.target.value } : l))} />
                  </label>
                ))}
                <button onClick={() => updateData('links', (data.links as Link[]).filter((_, i) => i !== index))}>
                  링크 제거
                </button>
              </div>
            ))}
            <button
              disabled={(data.links as Link[]).length >= 3}
              onClick={() => updateData('links', [...data.links as Link[], { label: '', url: '' }])}
            >링크 추가</button>
          </div>
          {data.photoId && <img className="photo-input" src={`/api/photos/${data.photoId}`} alt="등록된 사진" />}
          <label>사진 등록·변경 (JPG·PNG, 2MB 이하)
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={uploading}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file || uploading) return;
                if (file.size > 2000000) { onError('파일 크기가 2MB를 초과합니다.'); return; }
                if (!['image/jpeg', 'image/png'].includes(file.type)) { onError('JPG·PNG 사진을 선택하세요.'); return; }
                setUploading(true);
                try { updateData('photoId', await uploadPhoto(file)); }
                catch (error) { onError((error as Error).message); }
                finally { setUploading(false); }
              }}
            />
          </label>
          <button disabled={!data.photoId || uploading} onClick={() => updateData('photoId', null)}>사진 제거</button>
        </>
      )}
    </div>
  );
  const items = section.items ?? [];
  function updateItem(index: number, key: string, value: Value) {
    onChange({
      ...section,
      items: items.map((item, i) => i === index ? { ...item, [key]: value as string | boolean } : item),
    });
  }
  return (
    <div>
      <ResumeSortableList ids={items.map(item => String(item.id))} onMove={(from, to) => {
        const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]); onChange({ ...section, items: next });
      }}>
        {(_, index) => {
          const item = items[index];
          const first = itemFields[section.type]![0];
          const summary = [item[first] || '(제목 없음)', item[itemFields[section.type]![1]],
            'start' in item ? `${item.start} – ${item.current ? '현재' : item.end}` : ''].filter(Boolean).join(' · ');
          return (
            <div className="resume-item">
              <button onClick={() => onActiveItem(activeItem === item.id ? null : String(item.id))}>{summary}</button>
              <button disabled={items.length >= 20} onClick={() => {
                const copy = { ...item, id: crypto.randomUUID() };
                const next = [...items]; next.splice(index + 1, 0, copy);
                onChange({ ...section, items: next }); onActiveItem(copy.id);
              }}>항목 복제</button>
              <button onClick={() => onChange({ ...section, items: items.filter((_, i) => i !== index) })}>
                항목 삭제
              </button>
              {activeItem === item.id && (
                <div className="section-fields">
                  {itemFields[section.type]!.map(key => field(key, item, `${section.type}-${item.id}`,
                    (key, value) => updateItem(index, key, value)))}
                </div>
              )}
            </div>
          );
        }}
      </ResumeSortableList>
      <button disabled={items.length >= 20} onClick={() => {
        const item = newItem(section.type);
        onChange({ ...section, items: [...items, item] }); onActiveItem(String(item.id));
      }}>{sectionNames[section.type]} 항목 추가</button>
      {items.length >= 20 && <small>항목은 최대 20개입니다.</small>}
    </div>
  );
}
