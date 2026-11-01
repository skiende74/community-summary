import { matchingRules, ruleLookupResponseSchema, ruleScope, type SiteRule } from '@summary/contracts';
import { apiUrl } from '../config';
import { publicUrl } from './pageLinks';

const checksKey = 'siteRuleChecks:v2';
const day = 24 * 60 * 60 * 1000;
type Check = { at: number; rules: SiteRule[] };
const pending = new Map<string, Promise<SiteRule[]>>();
let writes = Promise.resolve();
async function remember(origin: string, rules: SiteRule[], at = Date.now()) {
  writes = writes.catch(() => {}).then(async () => {
    const stored = (await chrome.storage.local.get(checksKey))[checksKey];
    const entries = (stored && typeof stored === 'object' ? stored : {}) as Record<string, Check>;
    entries[origin] = { at, rules };
    await chrome.storage.local.set({ [checksKey]: Object.fromEntries(Object.entries(entries)
      .sort((a, b) => b[1].at - a[1].at).slice(0, 100)) });
  });
  return writes;
}
export async function rememberRule(rule: SiteRule) {
  const checks = (await chrome.storage.local.get(checksKey))[checksKey] as Record<string, Check> | undefined;
  const check = checks?.[rule.origin];
  await remember(rule.origin, [...(check?.rules || []).filter(r => ruleScope(r) !== ruleScope(rule)), rule].slice(-100), check?.at || 0);
}
export async function ruleRequest(path: 'lookup' | 'confirm', payload: { url: string; [key: string]: unknown }) {
  const response = await fetch(`${apiUrl}/site-rules/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Community-Summary': '1' },
    body: JSON.stringify({ ...payload, url: publicUrl(payload.url) }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('공용 규칙 서버에 연결하지 못했습니다.');
  return response.json();
}
export async function lookupCandidates(url: string, force = false): Promise<SiteRule[]> {
  const origin = new URL(url).origin;
  let work = pending.get(origin);
  if (!work) {
    work = (async () => {
      const checks = (await chrome.storage.local.get(checksKey))[checksKey] as Record<string, Check> | undefined;
      const checked = checks?.[origin];
      const elapsed = Date.now() - (checked?.at || 0);
      if (!force && checked && elapsed >= 0 && elapsed < day) return checked.rules || [];
      // 조회 실패도 하루 동안 반복하지 않는다. 기존 캐시는 유지한다.
      await remember(origin, checked?.rules || []);
      const data = ruleLookupResponseSchema.parse(await ruleRequest('lookup', { url, includeSiteRules: true }));
      const rules = (data.rules || (data.rule ? [data.rule] : [])).filter(rule => rule.origin === origin);
      await remember(origin, rules);
      return rules;
    })();
    pending.set(origin, work);
    void work.finally(() => pending.delete(origin)).catch(() => {});
  }
  return matchingRules(await work, url);
}
export async function lookupShared(url: string, _local?: SiteRule, force = false): Promise<SiteRule | null> {
  return (await lookupCandidates(url, force))[0] || null;
}
