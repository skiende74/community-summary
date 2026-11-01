import { requestSchema, responseSchema, ruleRequestSchema, ruleResponseSchema, siteRuleSchema } from '@summary/contracts';
import { apiUrl } from './config';
import { readRules, saveRule, matchRule, ruleScope, rulesKey } from './Sites_/rules';
import { syncScripts } from './Sites_/registration';

chrome.runtime.onInstalled.addListener(() => { void syncScripts(); });
chrome.runtime.onStartup.addListener(() => { void syncScripts(); });
chrome.permissions.onRemoved.addListener(() => { void syncScripts(); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url) return;
  const popup = sender.url === chrome.runtime.getURL('popup.html');
  if (!['summarize', 'generate-rule', 'save-rule', 'delete-rule'].includes(message?.type)) return;
  void (async () => {
    try {
      if (message.type !== 'summarize' && !popup) throw new Error('잘못된 요청입니다.');
      if (message.type === 'save-rule' || message.type === 'delete-rule') {
        const rule = siteRuleSchema.parse(message.rule);
        const tab = await chrome.tabs.get(message.tabId);
        if (tab.url !== message.url || !matchRule(rule, tab.url!)) throw new Error('페이지가 바뀌었습니다. 다시 확인해 주세요.');
        if (message.type === 'save-rule') {
          if (!await chrome.permissions.contains({ origins: [`${rule.origin}/*`] })) throw new Error('사이트 접근 권한이 필요합니다.');
          const preview = await chrome.tabs.sendMessage(message.tabId, { type: 'preview-rule', rule });
          if (!preview?.count || preview.url !== tab.url) throw new Error('댓글 추출 결과를 다시 확인해 주세요.');
          await saveRule(rule);
        } else {
          await chrome.storage.local.set({ [rulesKey]: (await readRules()).filter(r => ruleScope(r) !== ruleScope(rule)) });
        }
        await syncScripts();
        respond({ ok: true }); return;
      }
      const summarize = message.type === 'summarize';
      if (summarize && (!sender.tab || sender.frameId !== 0 ||
        (!/^https:\/\/(www\.)?dogdrip\.net\//.test(sender.url!) &&
        (!(await readRules()).some(rule => matchRule(rule, sender.url!)) ||
          !await chrome.permissions.contains({ origins: [`${new URL(sender.url!).origin}/*`] })))))
        throw new Error('등록한 게시판에서 요청해 주세요.');
      const payload = summarize ? requestSchema.parse(message.payload) : ruleRequestSchema.parse(message.payload);
      const response = await fetch(`${apiUrl}/${summarize ? 'summarize' : 'site-rules'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Community-Summary': '1',
          'X-Summary-Refresh': message.refresh === true ? '1' : '0' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(26_000),
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
