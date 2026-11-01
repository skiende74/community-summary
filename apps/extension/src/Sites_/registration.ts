import { readRules } from './rules';

let pending = Promise.resolve();
export function syncScripts() {
  pending = pending.catch(() => {}).then(async () => {
    const origins = [...new Set((await readRules()).map(rule => rule.origin))]
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
