import { responseSchema, type SummaryResponse } from '@summary/contracts';

export async function readSummary(key: string | null) {
  try {
    if (!key) return null;
    let value = (await chrome.storage.local.get(key))[key];
    const legacyKey = key.startsWith('community-summary:v2:dogdrip.net:')
      ? `community-summary:v1:${key.split(':').at(-1)}` : null;
    let migrated = false;
    if (!value) {
      const raw = legacyKey ? localStorage.getItem(legacyKey) : null;
      if (!raw) return null;
      value = JSON.parse(raw);
      migrated = true;
    }
    if (!value || typeof value !== 'object' || !('result' in value)) return null;
    const parsed = responseSchema.safeParse(value.result);
    if (!parsed.success) return null;
    const saved = { result: parsed.data, clipped: 'clipped' in value && value.clipped === true };
    if (migrated && legacyKey && await saveSummary(key, saved.result, saved.clipped)) {
      try { localStorage.removeItem(legacyKey); } catch { /* 이전 저장소 삭제 실패는 복원을 막지 않는다. */ }
    }
    return saved;
  } catch { return null; }
}

export async function saveSummary(key: string | null, result: SummaryResponse, clipped: boolean) {
  try {
    if (!key) return false;
    await chrome.storage.local.set({ [key]: { result, clipped } });
    return true;
  } catch { return false; }
}
