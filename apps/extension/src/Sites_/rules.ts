import { siteRuleSchema, matchRule, ruleScope, type SiteRule } from '@summary/contracts';
export { matchRule, ruleScope };
export const rulesKey = 'siteRules:v1';
export async function readRules(): Promise<SiteRule[]> {
  const raw = (await chrome.storage.local.get(rulesKey))[rulesKey];
  return Array.isArray(raw) ? raw.flatMap(value => {
    const parsed = siteRuleSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, 50) : [];
}
export async function saveRule(rule: SiteRule) {
  const rules = await readRules();
  await chrome.storage.local.set({ [rulesKey]: [...rules.filter(r => ruleScope(r) !== ruleScope(rule)), rule].slice(-50) });
}
