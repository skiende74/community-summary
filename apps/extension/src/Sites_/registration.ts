// Optional access persists across visits; activeTab alone must not enable automatic access.
export async function hasSiteAccess(url: string) {
  const host = new URL(url).hostname;
  return ((await chrome.permissions.getAll()).origins || []).some(pattern => {
    const match = /^https:\/\/([^/]+)\/\*$/.exec(pattern);
    return !!match && match[1] !== '*' && (match[1] === host ||
      match[1].startsWith('*.') && (host === match[1].slice(2) || host.endsWith(match[1].slice(1))));
  });
}
let pending = Promise.resolve();
export function syncScripts() {
  pending = pending.catch(() => {}).then(async () => {
    const manifest = chrome.runtime.getManifest();
    const base = manifest.content_scripts?.flatMap(script => script.matches || []) || [];
    const origins = (await chrome.permissions.getAll()).origins || [];
    const matches = origins.filter(origin => /^https:\/\/[^*][^/]*\/\*$/.test(origin)
      && !manifest.host_permissions?.includes(origin));
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['approved-sites'] });
    if (!matches.length) {
      if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: ['approved-sites'] });
      return;
    }
    const script = { id: 'approved-sites', matches, excludeMatches: base.concat('https://community-summary-api.vercel.app/*'),
      js: ['content.js'], runAt: 'document_idle' as const, persistAcrossSessions: true };
    if (scripts.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
  });
  return pending;
}
