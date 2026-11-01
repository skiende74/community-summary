import { ruleLookupResponseSchema, ruleScope, type SiteRule } from '@summary/contracts';
import { apiUrl } from '../config';

const checksKey = 'siteRuleChecks:v1';
const day = 24 * 60 * 60 * 1000;
const pending = new Map<string, Promise<SiteRule | null>>();
type Check = { at: number; rule: SiteRule | null };
let writes = Promise.resolve();
async function remember(key: string, rule: SiteRule | null) {
  writes = writes.catch(() => {}).then(async () => {
    const stored = (await chrome.storage.local.get(checksKey))[checksKey];
    const entries = (stored && typeof stored === 'object' ? stored : {}) as Record<string, Check>;
    entries[key] = { at: Date.now(), rule };
    const limited = Object.fromEntries(Object.entries(entries).sort((a, b) =>
      b[1].at - a[1].at).slice(0, 256));
    await chrome.storage.local.set({ [checksKey]: limited });
  });
  return writes;
}
export const rememberRule = (rule: SiteRule) => remember(ruleScope(rule), rule);
export async function ruleRequest(path: 'lookup' | 'confirm', payload: object) {
  const response = await fetch(`${apiUrl}/site-rules/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Community-Summary': '1' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('공용 규칙 서버에 연결하지 못했습니다.');
  return response.json();
}
export async function lookupShared(url: string, local?: SiteRule, force = false): Promise<SiteRule | null> {
  const key = local ? ruleScope(local) : url;
  const running = pending.get(key);
  if (running) return running;
  const work = (async () => {
    const checks = (await chrome.storage.local.get(checksKey))[checksKey] as Record<string, Check> | undefined;
    const checked = checks?.[key] as Check | undefined;
    const elapsed = Date.now() - (checked?.at || 0);
    if (!force && checked && elapsed >= 0 && elapsed < day) return null;
    // 실패해도 재방문/동시 탭에서 서버 요청이 반복되지 않게 먼저 기록한다.
    await remember(key, null);
    const rule = ruleLookupResponseSchema.parse(await ruleRequest('lookup', { url })).rule;
    await remember(key, rule);
    if (rule) await remember(ruleScope(rule), rule);
    return rule;
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
