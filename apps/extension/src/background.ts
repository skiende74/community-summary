import { isSiteRule, requestSchema, responseSchema, ruleRequestSchema, ruleResponseSchema, siteRuleSchema } from '@summary/contracts';
import { apiUrl } from './config';
import { readRules, saveRule, matchRule, ruleScope, rulesKey, setDisabled, disabledKey } from './Sites_/rules';
import { syncScripts } from './Sites_/registration';
import { lookupCandidates, ruleRequest, rememberRule } from './Sites_/shared';
import { refreshShared } from './Sites_/refresh';
import { ruleHeaders } from './Admin_/Admin';
import { readSettings } from './settings';

chrome.runtime.onInstalled.addListener(() => { void syncScripts(); });
chrome.runtime.onStartup.addListener(() => { void syncScripts(); });
chrome.permissions.onRemoved.addListener(() => { void syncScripts(); });
chrome.permissions.onAdded.addListener(() => { void syncScripts(); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url) return;
  const popup = sender.url === chrome.runtime.getURL('popup.html');
  if (!['summarize', 'generate-rule', 'save-rule', 'delete-rule', 'lookup-rule', 'check-rule', 'auto-apply'].includes(message?.type)) return;
  void (async () => {
    try {
      if (message.type === 'check-rule') { respond({ status: await refreshShared(sender) }); return; }
      if (message.type !== 'summarize' && !popup) throw new Error('잘못된 요청입니다.');
      if (message.type === 'auto-apply') {
        const tab = await chrome.tabs.get(message.tabId);
        if (tab.url !== message.url || !tab.url?.startsWith('https:')) throw new Error('페이지가 바뀌었습니다.');
        if (!await chrome.permissions.contains({ origins: [`${new URL(tab.url).origin}/*`] })) throw new Error('사이트 접근 권한이 필요합니다.');
        await syncScripts();
        await chrome.scripting.executeScript({ target: { tabId: message.tabId }, files: ['content.js'] });
        respond({ status: await refreshShared({ ...sender, url: tab.url, tab, frameId: 0 }) }); return;
      }
      if (message.type === 'lookup-rule') {
        const tab = await chrome.tabs.get(message.tabId);
        if (!tab.url || tab.url !== message.url || !tab.url.startsWith('https://')) throw new Error('페이지가 바뀌었습니다.');
        if (!await chrome.permissions.contains({ origins: [`${new URL(tab.url).origin}/*`] })) throw new Error('사이트 접근 권한이 필요합니다.');
        const rules = await lookupCandidates(tab.url, true);
        respond({ rule: rules[0] || null, rules }); return;
      }
      if (message.type === 'save-rule' || message.type === 'delete-rule') {
        const rule = siteRuleSchema.parse(message.rule);
        const tab = await chrome.tabs.get(message.tabId);
        if (tab.url !== message.url || !matchRule(rule, tab.url!)) throw new Error('페이지가 바뀌었습니다. 다시 확인해 주세요.');
        if (message.type === 'save-rule') {
          if (!await chrome.permissions.contains({ origins: [`${rule.origin}/*`] })) throw new Error('사이트 접근 권한이 필요합니다.');
          const preview = await chrome.tabs.sendMessage(message.tabId, { type: 'preview-rule', rule });
          if (!preview?.count || preview.url !== tab.url) throw new Error('댓글 추출 결과를 다시 확인해 주세요.');
          if (message.replaceSite) {
            if (!message.candidateId || !isSiteRule(rule)) throw new Error('사이트 공통 후보를 다시 생성해 주세요.');
            await ruleRequest('confirm', { candidateId: message.candidateId, url: tab.url!, replaceSite: true }, await ruleHeaders());
            await chrome.storage.local.set({ [rulesKey]: (await readRules()).filter(r => r.origin !== rule.origin || !isSiteRule(r)) });
          }
          await setDisabled(rule, tab.url!, false);
          await saveRule(rule, message.source === 'shared' ? 'shared' : 'generated');
          await rememberRule(rule, message.replaceSite === true);
        } else {
          await setDisabled(rule, tab.url!, true);
          await chrome.storage.local.set({ [rulesKey]: (await readRules()).filter(r => ruleScope(r) !== ruleScope(rule)) });
        }
        await syncScripts();
        const shared = message.replaceSite ? true : message.type === 'save-rule' && message.candidateId
          ? await ruleRequest('confirm', { candidateId: message.candidateId, url: tab.url! }).then(() => true).catch(() => false)
          : undefined;
        respond({ ok: true, shared }); return;
      }
      const summarize = message.type === 'summarize';
      if (summarize && (await readRules(disabledKey)).some(rule => matchRule(rule, sender.url!)))
        throw new Error('이 게시판의 요약 적용이 해제되어 있습니다.');
      if (summarize && (!sender.tab || sender.frameId !== 0 ||
        (!/^https:\/\/(www\.)?dogdrip\.net\//.test(sender.url!) &&
        (!(await readRules()).some(rule => matchRule(rule, sender.url!)) ||
          !await chrome.permissions.contains({ origins: [`${new URL(sender.url!).origin}/*`] })))))
        throw new Error('등록한 게시판에서 요청해 주세요.');
      const payload = summarize ? requestSchema.parse({ ...message.payload, tone: (await readSettings()).tone }) : ruleRequestSchema.parse(message.payload);
      const response = await fetch(`${apiUrl}/${summarize ? 'summarize' : 'site-rules'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Community-Summary': '1',
          'X-Summary-Refresh': message.refresh === true ? '1' : '0', ...(summarize ? {} : await ruleHeaders()) },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(summarize ? 26_000 : 30_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '서버 요청에 실패했습니다.');
      respond({ result: summarize ? responseSchema.parse(data) : ruleResponseSchema.parse(data) });
    } catch (error) {
      respond({ error: error instanceof Error ? error.message : '요청에 실패했습니다.' });
    }
  })();
  return true;
});
