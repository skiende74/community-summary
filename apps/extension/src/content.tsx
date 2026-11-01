import { createRoot, type Root } from 'react-dom/client';
import { findAnchor } from './Dogdrip_/Dogdrip';
import { readSettings, type Settings } from './settings';
import { SummaryPanel } from './SummaryPanel_/SummaryPanel';
import styles from './SummaryPanel_/styles.css?inline';

let root: Root | undefined;
let host: HTMLElement | undefined;
let settings: Settings;
let scheduled = false;
function mount() {
  scheduled = false;
  if (host && !host.isConnected) { root?.unmount(); root = undefined; host = undefined; }
  if (!settings?.enabled) {
    root?.unmount(); host?.remove(); root = undefined; host = undefined;
    return;
  }
  const anchor = findAnchor();
  if (!anchor || root) return;
  host = document.createElement('community-summary');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const container = document.createElement('div');
  shadow.append(style, container);
  anchor.before(host);
  root = createRoot(container);
  root.render(<SummaryPanel settings={settings} />);
}
async function start() {
  settings = await readSettings();
  mount();
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(mount);
  }).observe(document.body, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void readSettings().then(value => { settings = value; mount(); });
  });
}
void start();
