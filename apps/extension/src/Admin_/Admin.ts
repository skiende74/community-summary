import { apiUrl } from '../config';

const tokenKey = 'adminToken:v1';
const installationKey = 'installationId:v1';
let installation: Promise<string> | undefined;
async function installationId() {
  return installation ??= (async () => {
    const saved = (await chrome.storage.local.get(installationKey))[installationKey];
    if (typeof saved === 'string' && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ [installationKey]: id });
    return id;
  })().catch(error => { installation = undefined; throw error; });
}
export async function ruleHeaders(): Promise<Record<string, string>> {
  const token = (await chrome.storage.local.get(tokenKey))[tokenKey];
  return { 'X-Installation-Id': await installationId(),
    ...(typeof token === 'string' && token ? { Authorization: `Bearer ${token}` } : {}) };
}
export async function hasAdminToken() { return !!(await chrome.storage.local.get(tokenKey))[tokenKey]; }
export async function saveAdminToken(value: string) {
  const token = value.trim();
  if (token.length < 32 || token.length > 512 || /\s/.test(token)) throw new Error('관리자 토큰을 확인해 주세요.');
  const response = await fetch(`${apiUrl}/admin/verify`, {
    method: 'POST', headers: { 'X-Community-Summary': '1', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(response.status === 401 ? '관리자 토큰이 올바르지 않아요.' : '관리자 인증 서버에 연결하지 못했어요.');
  await chrome.storage.local.set({ [tokenKey]: token });
}
export async function clearAdminToken() { await chrome.storage.local.remove(tokenKey); }
