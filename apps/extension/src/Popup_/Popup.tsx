import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ruleResponseSchema, type SiteRule } from '@summary/contracts';
import { readRules, matchRule } from '../Sites_/rules';
import './styles.css';

type Preview = { title: string; count: number; comments: string[]; url: string };
async function request(message: object) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
}
function Popup() {
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [saved, setSaved] = useState<SiteRule>();
  const [rule, setRule] = useState<SiteRule>();
  const [candidateId, setCandidateId] = useState<string>();
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => { void (async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTab(active);
    if (active?.url) setSaved((await readRules()).find(r => matchRule(r, active.url!)));
  })().catch(() => setStatus('현재 탭을 확인하지 못했습니다.')); }, []);
  const valid = !!tab?.id && !!tab.url?.startsWith('https://');
  const builtin = !!tab?.url && /^https:\/\/(www\.)?dogdrip\.net\//.test(tab.url);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setStatus('');
    try { await action(); } catch (error) { setStatus(error instanceof Error ? error.message : '다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const generate = () => run(async () => {
    if (!valid) return;
    const origin = new URL(tab!.url!).origin;
    if (!await chrome.permissions.request({ origins: [`${origin}/*`] })) throw new Error('사이트 접근 권한이 필요합니다.');
    setRule(undefined); setPreview(undefined); setCandidateId(undefined);
    await chrome.scripting.executeScript({ target: { tabId: tab!.id! }, files: ['content.js'] });
    let ready;
    for (let attempt = 0; attempt < 6; attempt++) {
      try { ready = await chrome.tabs.sendMessage(tab!.id!, { type: 'rule-ready' }); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 150)); }
    }
    if (!ready) throw new Error('페이지를 새로고침한 뒤 다시 시도해 주세요.');
    if ((await chrome.tabs.get(tab!.id!)).url !== tab!.url) throw new Error('페이지가 바뀌었습니다. 팝업을 다시 열어 주세요.');
    if (!saved) {
      setStatus('저장된 게시판 규칙을 확인하는 중…');
      const shared = await request({ type: 'lookup-rule', tabId: tab!.id, url: tab!.url }).catch(() => null);
      if (shared?.rule) {
        const check: Preview | null = await chrome.tabs.sendMessage(tab!.id!, { type: 'preview-rule', rule: shared.rule });
        if (check?.count && check.url === tab!.url) {
          await request({ type: 'save-rule', rule: shared.rule, tabId: tab!.id, url: tab!.url });
          setSaved(shared.rule); setStatus('저장된 게시판 규칙을 바로 적용했습니다.'); return;
        }
      }
    }
    setStatus('추출 규칙을 만드는 중… 팝업을 열어 두세요.');
    const snapshot = await chrome.tabs.sendMessage(tab!.id!, { type: 'snapshot' });
    const result = ruleResponseSchema.parse((await request({ type: 'generate-rule', payload: snapshot })).result);
    if (!result.supported || !result.rule) throw new Error(result.reason || '댓글이 있는 공개 게시글에서 시도해 주세요.');
    const checked: Preview | null = await chrome.tabs.sendMessage(tab!.id!, { type: 'preview-rule', rule: result.rule });
    if (!checked?.count || checked.url !== tab!.url) throw new Error('댓글을 정확히 찾지 못했습니다. 댓글을 펼친 뒤 다시 시도해 주세요.');
    setRule(result.rule); setCandidateId(result.candidateId); setPreview(checked); setStatus('댓글 본문만 추출됐는지 확인해 주세요.');
  });
  return <main>
    <header><strong>댓글 요약</strong><button className="link" onClick={() => void chrome.runtime.openOptionsPage()}>설정</button></header>
    <p className="site">{valid ? new URL(tab!.url!).hostname : 'HTTPS 게시글에서 열어 주세요.'}</p>
    {builtin ? <p>개드립은 기본 지원합니다.</p> : <>
      <p>{saved ? '이 게시판에 요약이 적용되어 있어요.' : '이 게시판의 댓글 추출 규칙을 만들어요.'}</p>
      <p className="muted">규칙 생성 시 현재 페이지의 텍스트와 HTML 구조를 서버·OpenAI에 전송합니다. 공개 게시글에서 사용해 주세요.</p>
      <button disabled={!valid || busy} onClick={generate}>{saved ? '규칙 다시 만들기' : '이 게시판에 적용'}</button>
      {saved && <button className="link" disabled={busy} onClick={() => void run(async () => {
        await request({ type: 'delete-rule', rule: saved, tabId: tab!.id, url: tab!.url });
        setSaved(undefined); setRule(undefined); setPreview(undefined); setStatus('저장한 규칙을 삭제했습니다.');
      })}>적용 해제</button>}
    </>}
    <p role="status">{status}</p>
    {preview && rule && <section>
      <h2>추출 미리보기</h2><strong>{preview.title}</strong>
      <p className="muted">텍스트 댓글 {preview.count}개 · 처음 3개 확인</p>
      <ul>{preview.comments.map((text, i) => <li key={i}>{text}</li>)}</ul>
      <p className="scope">적용 경로: {rule.pathTemplate}{rule.idQuery ? `?${rule.idQuery}={id}` : ''}</p>
      <button disabled={busy} onClick={() => void run(async () => {
        const result = await request({ type: 'save-rule', rule, candidateId, tabId: tab!.id, url: preview.url });
        setSaved(rule); setRule(undefined); setPreview(undefined);
        setStatus(result.shared === false || !candidateId ? '로컬에 저장했습니다. 공용 저장은 완료되지 않았습니다.' : '저장했습니다. 다음 게시글부터 자동 적용됩니다.');
      })}>이 내용으로 저장</button>
    </section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Popup />);
