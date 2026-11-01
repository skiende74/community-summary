import { apiUrl } from '../config';
import { requireConsent } from '../Consent_/Consent';
import { readRules } from './rules';

const key = 'hostCatalog:v1';
const day = 86400000;
type Catalog = { hosts: string[]; at: number; retryAt: number };
let pending: Promise<string[]> | undefined;
export async function registeredHost(url: string) {
  await requireConsent();
  const host = new URL(url).hostname;
  if ((await readRules()).some(rule => new URL(rule.origin).hostname === host)) return true;
  pending ??= load().finally(() => { pending = undefined; });
  return (await pending).includes(host);
}
async function load(): Promise<string[]> {
  const raw = (await chrome.storage.local.get(key))[key] as Catalog | undefined;
  const saved = raw && Array.isArray(raw.hosts) && raw.hosts.every(h => typeof h === 'string') ? raw : undefined;
  const now = Date.now();
  if (saved && (now < saved.at + day || now < saved.retryAt)) return saved.hosts;
  try {
    await requireConsent();
    // 현재 페이지 URL, 설치 ID, Referer를 포함하지 않는 공통 목록 요청.
    const response = await fetch(`${apiUrl}/site-rules/hosts`, {
      headers: { 'X-Community-Summary': '1' }, credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Catalog unavailable');
    const data = await response.json();
    if (!Array.isArray(data.hosts) || data.hosts.length > 100000 ||
      !data.hosts.every((h: unknown) => typeof h === 'string' && /^[a-z0-9.-]+$/.test(h))) throw new Error('Invalid catalog');
    await chrome.storage.local.set({ [key]: { hosts: data.hosts, at: now, retryAt: 0 } });
    return data.hosts;
  } catch {
    await chrome.storage.local.set({ [key]: { hosts: saved?.hosts || [], at: saved?.at || 0, retryAt: now + 3600000 } });
    return saved?.hosts || [];
  }
}
