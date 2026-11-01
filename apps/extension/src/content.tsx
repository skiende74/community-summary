import { createRoot, type Root } from 'react-dom/client';
import { siteRuleSchema, type SiteRule } from '@summary/contracts';
import { inspect, type Page } from './Sites_/Sites';
import { readRules, matchRule, rulesKey } from './Sites_/rules';
import { snapshot } from './Sites_/snapshot';
import { diagnose } from './Sites_/diagnose';
import { readSettings, type Settings } from './settings';
import { SummaryPanel } from './SummaryPanel_/SummaryPanel';
import styles from './SummaryPanel_/styles.css?inline';

async function start() {
  const [initialSettings, initialRules] = await Promise.all([readSettings(), readRules()]);
  let settings: Settings = initialSettings, rules: SiteRule[] = initialRules;
  let root: Root | undefined, host: HTMLElement | undefined, mounted: Page | null = null;
  const href = location.href;
  let timer = 0, lastSignature = '';
  let stableSince = 0;
  const clear = () => { root?.unmount(); host?.remove(); root = undefined; host = undefined; mounted = null; };
  const currentRule = () => rules.find(rule => matchRule(rule, location.href));
  const getPage = () => location.href === href ? inspect(currentRule()) : null;
  const tick = () => {
    timer = 0;
    if (!settings.enabled) { clear(); return; }
    const page = getPage();
    if (!page) { clear(); return; }
    if (host && !host.isConnected) clear();
    if (mounted && mounted.key !== page.key) clear();
    if (root && mounted && !(mounted.payload.comments.length === 0 && page.payload.comments.length > 0)) return;
    if (root) clear();
    if (lastSignature !== page.fingerprint) {
      lastSignature = page.fingerprint; stableSince = Date.now();
    }
    if (Date.now() - stableSince < 800) { schedule(); return; }
    host = document.createElement('community-summary');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = styles;
    const container = document.createElement('div'); shadow.append(style, container);
    page.anchor.before(host);
    mounted = page;
    root = createRoot(container);
    root.render(<SummaryPanel key={page.key} settings={settings} page={page} getPage={getPage} />);
  };
  const schedule = () => { if (!timer) timer = window.setTimeout(tick, 250); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('enabled' in changes || 'expanded' in changes) void readSettings().then(value => { settings = value; schedule(); });
    if (rulesKey in changes) void readRules().then(value => { rules = value; clear(); schedule(); });
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'extraction-status') respond({ url: location.href, status: !settings.enabled
      ? { kind: 'disabled', message: '설정에서 요약 기능을 켜면 사용할 수 있어요.' }
      : location.href !== href ? { kind: 'error', message: '게시글을 새로고침해 주세요.' } : diagnose(currentRule()) });
    if (message?.type === 'rule-ready') respond({ url: location.href });
    if (message?.type === 'snapshot') respond(snapshot());
    if (message?.type === 'preview-rule') {
      const parsed = siteRuleSchema.safeParse(message.rule);
      const page = parsed.success ? inspect(parsed.data) : null;
      respond(page ? { title: page.payload.title, count: page.payload.comments.length,
        comments: page.payload.comments.slice(0, 3).map(c => c.text.slice(0, 180)), url: location.href } : null);
    }
  });
  schedule();
  if (settings.enabled && currentRule()) void chrome.runtime.sendMessage({ type: 'check-rule' }).catch(() => {});
}
const scope = globalThis as typeof globalThis & { communitySummaryStarted?: boolean };
if (!scope.communitySummaryStarted) { scope.communitySummaryStarted = true; void start(); }
