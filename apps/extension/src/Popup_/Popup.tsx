import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isSiteRule, ruleResponseSchema, type SiteRule } from '@summary/contracts';
import { readRules, matchingRules, ruleScope, sourceKey, disabledKey, matchRule, type RuleSources } from '../Sites_/rules';
import { previewRules, type Preview } from '../Sites_/preview';
import { hasAdminToken } from '../Admin_/Admin';
import './styles.css';
import { ExtractionStatus } from './ExtractionStatus';

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
  const [permitted, setPermitted] = useState(false);
  const [source, setSource] = useState('');
  const [admin, setAdmin] = useState(false);
  const [replaceSite, setReplaceSite] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void (async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTab(active);
    setAdmin(await hasAdminToken());
    if (!active?.id || !active.url?.startsWith('https:')) return;
    const allowed = await chrome.permissions.contains({ origins: [`${new URL(active.url).origin}/*`] });
    setPermitted(allowed);
    if (allowed && !/^https:\/\/(www\.)?dogdrip\.net\//.test(active.url)) {
      setBusy(true);
      try {
        const result = await request({ type: 'auto-apply', tabId: active.id, url: active.url });
        setStatus(result.status?.message || '');
        setFailed(result.status?.kind === 'error');
      } finally { setBusy(false); }
    }
    const disabled = (await readRules(disabledKey)).some(r => matchRule(r, active.url!));
    const local = disabled ? undefined : matchingRules(await readRules(), active.url)[0];
    setSaved(local);
    const metadata = (await chrome.storage.local.get(sourceKey))[sourceKey] as RuleSources | undefined;
    if (local && metadata?.[ruleScope(local)]) setSource(metadata[ruleScope(local)].source === 'shared' ? '공용 규칙에서 적용' : 'AI로 새로 생성');
  })().catch(() => setStatus('현재 탭을 확인하지 못했습니다.')); }, []);
  const valid = !!tab?.id && !!tab.url?.startsWith('https://');
  const builtin = !!tab?.url && /^https:\/\/(www\.)?dogdrip\.net\//.test(tab.url);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setStatus('');
    try { await action(); } catch (error) { setStatus(error instanceof Error ? error.message : '다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const generate = (site = false, replace = false) => run(async () => {
    if (!valid) return;
    const origin = new URL(tab!.url!).origin;
    if (!await chrome.permissions.contains({ origins: [`${origin}/*`] })) throw new Error('Chrome 확장 메뉴에서 이 사이트의 접근을 허용한 뒤 새로고침해 주세요.');
    setPermitted(true);
    setRule(undefined); setPreview(undefined); setCandidateId(undefined); setReplaceSite(replace);
    await chrome.scripting.executeScript({ target: { tabId: tab!.id! }, files: ['content.js'] });
    let ready;
    for (let attempt = 0; attempt < 6; attempt++) {
      try { ready = await chrome.tabs.sendMessage(tab!.id!, { type: 'rule-ready' }); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 150)); }
    }
    if (!ready) throw new Error('페이지를 새로고침한 뒤 다시 시도해 주세요.');
    if ((await chrome.tabs.get(tab!.id!)).url !== tab!.url) throw new Error('페이지가 바뀌었습니다. 팝업을 다시 열어 주세요.');
    let boardOnly = !site && (!!saved || failed);
    if (!boardOnly && !site) {
      setStatus('저장된 게시판 규칙을 확인하는 중…');
      const shared = await request({ type: 'lookup-rule', tabId: tab!.id, url: tab!.url }).catch(() => null);
      if (shared?.rule) {
        const check = await previewRules(tab!.id!, tab!.url!, shared.rules || [shared.rule]);
        if (check) {
          await request({ type: 'save-rule', rule: check.rule, source: 'shared', tabId: tab!.id, url: tab!.url });
          setSaved(check.rule); setSource('공용 규칙에서 적용'); setStatus('공용 규칙을 바로 적용했습니다.'); return;
        }
        boardOnly = true;
      }
    }
    setStatus('추출 규칙을 만드는 중… 팝업을 열어 두세요.');
    const snapshot = await chrome.tabs.sendMessage(tab!.id!, { type: 'snapshot' });
    const result = ruleResponseSchema.parse((await request({ type: 'generate-rule', payload: { ...snapshot, mode: boardOnly ? 'board' : 'auto', replaceSite: replace } })).result);
    if (!result.supported || !result.rule) throw new Error(result.reason || '댓글이 있는 공개 게시글에서 시도해 주세요.');
    if (replace && (!isSiteRule(result.rule) || !result.candidateId)) throw new Error('공통 규칙 후보를 생성하지 못했습니다. 기존 규칙은 유지됩니다.');
    const checked = await previewRules(tab!.id!, tab!.url!, [result.rule]);
    if (!checked) throw new Error('댓글을 정확히 찾지 못했습니다. 댓글을 펼친 뒤 다시 시도해 주세요.');
    setRule(result.rule); setCandidateId(result.candidateId); setPreview(checked.preview); setStatus('댓글 본문만 추출됐는지 확인해 주세요.');
  });
  return <main>
    <header><strong>댓글 요약</strong><button className="link" onClick={() => void chrome.runtime.openOptionsPage()}>설정</button></header>
    <p className="site">{valid ? new URL(tab!.url!).hostname : 'HTTPS 게시글에서 열어 주세요.'}</p>
    {valid && (permitted || builtin) && <ExtractionStatus tabId={tab!.id!} url={tab!.url!} />}
    {saved && <p className="muted">{isSiteRule(saved) ? '사이트 공통 규칙' : '게시판 맞춤 규칙'}{source ? ` · ${source}` : ''}</p>}
    {builtin ? <p>이 커뮤니티는 별도 설정 없이 사용할 수 있어요.</p> : <>
      {!saved && <p>{permitted ? '공용 규칙이 없거나 맞지 않으면 게시판 맞춤 설정을 진행해 주세요.' : '사이트 접근이 제한되어 있어요. Chrome 확장 메뉴에서 이 사이트의 접근을 허용하고 새로고침해 주세요.'}</p>}
      <p className="muted">규칙 생성 시 현재 페이지의 텍스트와 HTML 구조를 서버·OpenAI에 전송합니다. 공개 게시글에서 사용해 주세요.</p>
      <button disabled={!valid || !permitted || busy} onClick={() => generate()}>{saved || failed ? '이 게시판 맞춤 설정' : '이 게시판 초기 설정'}</button>
      {admin && <button className="link" disabled={!valid || !permitted || busy} onClick={() => generate(true, true)}>사이트 공통 규칙 다시 만들기 (관리자)</button>}
      {saved && !isSiteRule(saved) && <button className="link" disabled={busy} onClick={() => generate(true)}>사이트 공통 규칙 만들기</button>}
      {saved && <button className="link" disabled={busy} onClick={() => void run(async () => {
        await request({ type: 'delete-rule', rule: saved, tabId: tab!.id, url: tab!.url });
        setSaved(undefined); setRule(undefined); setPreview(undefined); setSource(''); setStatus('이 게시판의 자동 적용을 해제했습니다.');
      })}>적용 해제</button>}
    </>}
    <p role="status">{status}</p>
    {preview && rule && <section>
      {replaceSite && <p>저장하면 다른 사용자에게도 제공되는 사이트 공통 규칙을 교체합니다. 게시판별 규칙은 유지됩니다.</p>}
      <h2>추출 미리보기</h2><strong>{preview.title}</strong>
      <p className="muted">텍스트 댓글 {preview.count}개 · 처음 3개 확인</p>
      <ul>{preview.comments.map((text, i) => <li key={i}>{text}</li>)}</ul>
      <p className="scope">{isSiteRule(rule) ? '사이트 공통' : '이 게시판'} · {rule.pathTemplate}{rule.idQuery ? `?${rule.idQuery}={id}` : ''}</p>
      <button disabled={busy} onClick={() => void run(async () => {
        const result = await request({ type: 'save-rule', rule, candidateId, replaceSite, tabId: tab!.id, url: preview.url });
        setSaved(rule); setSource('AI로 새로 생성'); setRule(undefined); setPreview(undefined); setFailed(false);
        setStatus(replaceSite ? '사이트 공통 규칙을 교체했습니다. 다른 사용자는 다음 규칙 조회부터 반영됩니다.' : result.shared === false || !candidateId ? '내 확장에 저장했습니다. 공용 등록은 실패했거나 기존 사이트 공통 규칙이 유지됩니다.' : '저장했습니다. 다음 게시글부터 자동 적용됩니다.');
      })}>{replaceSite ? '이 내용으로 공통 규칙 교체' : '이 내용으로 저장'}</button>
    </section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Popup />);
