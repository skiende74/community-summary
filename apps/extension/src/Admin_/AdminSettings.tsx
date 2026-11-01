import { useRef, useState } from 'react';
import { clearAdminToken, hasAdminToken, saveAdminToken } from './Admin';

export function AdminSettings() {
  const taps = useRef({ count: 0, at: 0 });
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function reveal() {
    const now = Date.now();
    taps.current = { count: now - taps.current.at < 3000 ? taps.current.count + 1 : 1, at: now };
    if (taps.current.count < 5) return;
    setVisible(true);
    try { setSaved(await hasAdminToken()); } catch { setStatus('인증 상태를 불러오지 못했어요.'); }
  }
  async function update(remove = false) {
    setBusy(true); setStatus('');
    try {
      if (remove) await clearAdminToken(); else await saveAdminToken(token);
      setSaved(!remove); setToken('');
      setStatus(remove ? '관리자 인증을 해제했어요.' : '관리자 인증을 저장했어요.');
    } catch (error) { setStatus(error instanceof Error ? error.message : '저장하지 못했어요.'); }
    finally { setBusy(false); }
  }
  return <footer>
    <button className="version" onClick={() => void reveal()}>버전 {chrome.runtime.getManifest().version}</button>
    {visible && <section className="admin-settings">
      <strong>관리자 인증</strong>
      <small>{saved ? '관리자 토큰이 저장되어 있어요. 요청할 때 서버에서 다시 검증해요.' : '서버에서 발급한 관리자 토큰을 입력해 주세요.'}</small>
      <form onSubmit={event => { event.preventDefault(); void update(); }}>
        <input aria-label="관리자 토큰" type="password" autoComplete="off" maxLength={512}
          value={token} onChange={event => setToken(event.target.value)} disabled={busy} />
        <button disabled={busy || !token.trim()}>인증 후 저장</button>
        {saved && <button type="button" disabled={busy} onClick={() => void update(true)}>인증 해제</button>}
      </form>
      <p role="status">{status}</p>
    </section>}
  </footer>;
}
