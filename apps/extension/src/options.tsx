import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readSettings, type Settings } from './settings';
import './options.css';
import { apiUrl } from './config';

function Options() {
  const [settings, setSettings] = useState<Settings>();
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { void readSettings().then(setSettings).catch(() => setStatus('설정을 불러오지 못했어요.')); }, []);
  async function change(key: keyof Settings, value: boolean) {
    if (!settings) return;
    setSaving(true);
    try {
      const next = { ...settings, [key]: value };
      await chrome.storage.local.set(next);
      setSettings(next);
      setStatus('저장했어요. 펼침 설정은 새로 여는 게시글부터 적용돼요.');
    } catch { setStatus('저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  }
  return <main>
    <span className="eyebrow">COMMUNITY SUMMARY</span>
    <h1>댓글을 읽기 전, 반응부터.</h1>
    <p>개드립 댓글 반응을 1~4줄로 정리해요.</p>
    {settings && <section>
      <label><span>요약 기능 사용<small>댓글 상단에 요약 카드를 표시해요.</small></span>
        <input type="checkbox" checked={settings.enabled} disabled={saving}
          onChange={e => void change('enabled', e.target.checked)} /></label>
      <label><span>새 게시글에서 요약 펼쳐두기<small>꺼두면 펼칠 때 요약을 생성해요.</small></span>
        <input type="checkbox" checked={settings.expanded} disabled={saving || !settings.enabled}
          onChange={e => void change('expanded', e.target.checked)} /></label>
    </section>}
    <p role="status">{status}</p>
    <p>요약 서버: <code>{apiUrl}</code></p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Options />);
