import type { SiteRule } from '@summary/contracts';
export type Preview = { title: string; count: number; comments: string[]; url: string };
export async function previewRules(tabId: number, url: string, rules: SiteRule[],
  wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await wait(1000);
    if ((await chrome.tabs.get(tabId)).url !== url) return null;
    for (const rule of rules) {
      const preview: Preview | null = await chrome.tabs.sendMessage(tabId, { type: 'preview-rule', rule }).catch(() => null);
      if (preview?.count && preview.url === url) return { rule, preview };
    }
  }
  return null;
}
