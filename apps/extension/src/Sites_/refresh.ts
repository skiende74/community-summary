import { isSiteRule, type SiteRule } from '@summary/contracts';
import { matchRule, matchingRules, ruleScope, readRules, saveRule, disabledKey } from './rules';
import { lookupCandidates } from './shared';
import { readSettings } from '../settings';
import { previewRules } from './preview';

export type SharedStatus = { kind: 'ok' | 'empty' | 'error' | 'disabled' | 'checking' | 'unconfigured'; message: string };
const pending = new Map<string, Promise<SharedStatus>>();
export function refreshShared(sender: chrome.runtime.MessageSender): Promise<SharedStatus> {
  const key = `${sender.tab?.id}:${sender.url}`;
  const running = pending.get(key);
  if (running) return running;
  const work = refresh(sender);
  pending.set(key, work);
  void work.finally(() => pending.delete(key)).catch(() => {});
  return work;
}
async function refresh(sender: chrome.runtime.MessageSender): Promise<SharedStatus> {
  const url = sender.url, tabId = sender.tab?.id;
  if (!url?.startsWith('https:') || !tabId || sender.frameId !== 0 || !(await readSettings()).enabled)
    return { kind: 'disabled', message: '요약 기능이 꺼져 있어요.' };
  const origin = new URL(url).origin;
  if (!await chrome.permissions.contains({ origins: [`${origin}/*`] }))
    return { kind: 'error', message: '사이트 접근 권한을 먼저 허용해 주세요.' };
  if ((await readRules(disabledKey)).some(rule => matchRule(rule, url)))
    return { kind: 'disabled', message: '이 게시판의 자동 적용을 해제했어요. 맞춤 설정으로 다시 적용할 수 있어요.' };
  let shared: SiteRule[];
  try { shared = await lookupCandidates(url); }
  catch { return { kind: 'error', message: '공용 규칙을 조회하지 못했어요. 기존 로컬 규칙은 유지돼요.' }; }
  const local = matchingRules(await readRules(), url);
  const candidates = matchingRules([...local.filter(rule => !shared.some(s => ruleScope(s) === ruleScope(rule))), ...shared], url);
  if (!candidates.length) return { kind: 'unconfigured', message: '등록된 공용 규칙이 없어요. 이 게시판 맞춤 설정을 진행해 주세요.' };
  const result = await previewRules(tabId, url, candidates);
  if (!result) return { kind: 'error', message: '1초 간격으로 두 번 더 확인했지만 댓글을 찾지 못했어요. 댓글 로딩 상태를 확인하거나 이 게시판 맞춤 설정을 진행해 주세요.' };
  if ((await chrome.tabs.get(tabId)).url !== url || !(await readSettings()).enabled
    || !await chrome.permissions.contains({ origins: [`${origin}/*`] })
    || (await readRules(disabledKey)).some(rule => matchRule(rule, url)))
    return { kind: 'disabled', message: '페이지 또는 설정이 바뀌어 적용을 중단했어요.' };
  if (!local.some(rule => JSON.stringify(rule) === JSON.stringify(result.rule))) await saveRule(result.rule, 'shared');
  return { kind: 'ok', message: isSiteRule(result.rule) ? '사이트 공통 규칙을 적용했어요.' : '게시판별 규칙을 적용했어요.' };
}
