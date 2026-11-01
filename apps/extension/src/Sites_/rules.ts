import { matchingRules, siteRuleSchema, matchRule, ruleScope, specializeRule, type SiteRule } from '@summary/contracts';
export { matchRule, ruleScope, matchingRules };
export const rulesKey = 'siteRules:v1';
export const disabledKey = 'disabledSiteRules:v1';
export const sourceKey = 'siteRuleSources:v1';
export type RuleSources = Record<string, { source: 'shared' | 'generated'; at: number }>;
export async function readRules(key = rulesKey): Promise<SiteRule[]> {
  const raw = (await chrome.storage.local.get(key))[key];
  return Array.isArray(raw) ? raw.flatMap(value => {
    const parsed = siteRuleSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, 50) : [];
}
let writing = Promise.resolve();
export function saveRule(rule: SiteRule, source: 'shared' | 'generated' = 'generated') {
  writing = writing.catch(() => {}).then(async () => {
    const rules = [...(await readRules()).filter(r => ruleScope(r) !== ruleScope(rule)), rule].slice(-50);
    const sources = ((await chrome.storage.local.get(sourceKey))[sourceKey] || {}) as RuleSources;
    sources[ruleScope(rule)] = { source, at: Date.now() };
    await chrome.storage.local.set({ [rulesKey]: rules, [sourceKey]: Object.fromEntries(rules
      .filter(r => sources[ruleScope(r)]).map(r => [ruleScope(r), sources[ruleScope(r)]])) });
  });
  return writing;
}
export async function setDisabled(rule: SiteRule, url: string, disabled: boolean) {
  const rules = (await readRules(disabledKey)).filter(r => !matchRule(r, url));
  await chrome.storage.local.set({ [disabledKey]: disabled ? [...rules, specializeRule(rule, url)].slice(-50) : rules });
}
