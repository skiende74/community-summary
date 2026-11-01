import { matchRule, ruleScope, readRules, saveRule } from './rules';
import { lookupShared } from './shared';
import { readSettings } from '../settings';

export async function refreshShared(sender: chrome.runtime.MessageSender) {
  if (!sender.url || !sender.tab?.id || sender.frameId !== 0 || !(await readSettings()).enabled) return;
  const local = (await readRules()).find(rule => matchRule(rule, sender.url!));
  if (!local || !await chrome.permissions.contains({ origins: [`${local.origin}/*`] })) return;
  const rule = await lookupShared(sender.url, local).catch(() => null);
  if (!rule || ruleScope(rule) !== ruleScope(local) || JSON.stringify(rule) === JSON.stringify(local)) return;
  const preview = await chrome.tabs.sendMessage(sender.tab.id, { type: 'preview-rule', rule });
  if (preview?.count && preview.url === sender.url && (await chrome.tabs.get(sender.tab.id)).url === sender.url)
    await saveRule(rule);
}
