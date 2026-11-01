import { readRules } from './rules';
import { apiUrl } from '../config';

let pending = Promise.resolve();
export function syncScripts() {
  pending = pending.catch(() => {}).then(async () => {
    const granted = (await chrome.permissions.getAll()).origins || [];
    const origins = [...new Set([...granted.filter(pattern => /^https:\/\/[^/*]+\/\*$/.test(pattern))
      .map(pattern => pattern.slice(0, -2)), ...(await readRules()).map(rule => rule.origin)])]
      .filter(origin => origin !== new URL(apiUrl).origin)
      .filter(origin => !/^https:\/\/(www\.)?dogdrip\.net$/.test(origin));
    const allowed = await Promise.all(origins.map(async origin =>
      await chrome.permissions.contains({ origins: [`${origin}/*`] }) ? `${origin}/*` : null));
    const matches = allowed.filter((value): value is string => !!value);
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: ['approved-sites'] });
    if (!matches.length) {
      if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: ['approved-sites'] });
    } else if (registered.length) {
      await chrome.scripting.updateContentScripts([{ id: 'approved-sites', matches, js: ['content.js'] }]);
    } else {
      await chrome.scripting.registerContentScripts([{ id: 'approved-sites', matches,
        js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
    }
  });
  return pending;
}
