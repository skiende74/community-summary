import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readSettings, type Settings } from './settings';
import './options.css';
import { AdminSettings } from './Admin_/AdminSettings';

const toneExamples = { brief: '신고자를 비판하는 반응이 많음.', haeyo: '신고자를 비판하는 반응이 많아요.', formal: '신고자를 비판하는 반응이 많습니다.' };

function Options() {
  const [settings, setSettings] = useState<Settings>();
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void readSettings().then(setSettings).catch(() => setStatus('설정을 불러오지 못했어요.')); }, []);
  async function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return;
    setSaving(true);
    try {
      const next = { ...settings, [key]: value };
      await chrome.storage.local.set(next);
      setSettings(next);
      setStatus(key === 'tone' ? '저장했어요. 새 요약이나 요약 갱신부터 선택한 말투로 보여드려요.'
        : '저장했어요. 펼침 설정은 새로 여는 게시글부터 적용돼요.');
    } catch { setStatus('저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  }
  return <main>
    <span className="eyebrow">COMMUNITY SUMMARY</span>
    <h1>댓글 반응을 요약해, 한눈에 편하게.</h1>
    <p>커뮤니티 댓글의 다양한 반응을 짧게 정리해 드려요.</p>
    {settings && <section>
      <label><span>요약 기능 사용<small>댓글 상단에 요약 카드를 표시해요.</small></span>
        <input type="checkbox" checked={settings.enabled} disabled={saving}
          onChange={e => void change('enabled', e.target.checked)} /></label>
      <label><span>새 게시글에서 요약 펼쳐두기<small>꺼두면 펼칠 때 요약을 생성해요.</small></span>
        <input type="checkbox" checked={settings.expanded} disabled={saving || !settings.enabled}
          onChange={e => void change('expanded', e.target.checked)} /></label>
      <label><span>요약 말투<small>{toneExamples[settings.tone]}</small>
        <small>기존 요약은 유지되며, 요약 갱신 시 새 말투가 적용돼요.</small></span>
        <select value={settings.tone} disabled={saving}
          onChange={e => void change('tone', e.target.value as Settings['tone'])}>
          <option value="brief">음슴체</option><option value="haeyo">해요체 (기본)</option><option value="formal">습니다체</option>
        </select></label>
    </section>}
    <p role="status">{status}</p>
    <AdminSettings />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Options />);
