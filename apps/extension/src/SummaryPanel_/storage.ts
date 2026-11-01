import { responseSchema, type SummaryResponse } from '@summary/contracts';

function storageKey() {
  const url = new URL(location.href);
  const id = url.searchParams.get('document_srl')
    || url.pathname.match(/\/(\d+)\/?$/)?.[1]
    || document.querySelector('.xe_content[class*="document_"]')?.className.match(/document_(\d+)_/)?.[1];
  return id && /^\d+$/.test(id) ? `community-summary:v1:${id}` : null;
}

export function readSummary() {
  try {
    const key = storageKey();
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) return null;
    const value = JSON.parse(raw);
    const parsed = responseSchema.safeParse(value.result);
    return parsed.success ? { result: parsed.data, clipped: value.clipped === true } : null;
  } catch { return null; }
}

export function saveSummary(result: SummaryResponse, clipped: boolean) {
  try {
    const key = storageKey();
    if (!key) return false;
    localStorage.setItem(key, JSON.stringify({ result, clipped }));
    return true;
  } catch { return false; }
}
