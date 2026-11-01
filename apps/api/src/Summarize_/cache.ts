import { resolveTone } from './tone.js';
import { createHash } from 'node:crypto';
import type { SummaryRequest, SummaryResponse } from '@summary/contracts';
import { model, promptVersion } from './prompt.js';

const results = new Map<string, { expires: number; value: SummaryResponse }>();
export const pending = new Map<string, Promise<SummaryResponse>>();
export const cacheKey = ({ tone = resolveTone(), ...content }: SummaryRequest) => createHash('sha256')
  .update(JSON.stringify([model, 'low', promptVersion, tone, content])).digest('hex');
export function getCached(key: string) {
  const item = results.get(key);
  if (item && item.expires > Date.now()) return item.value;
  results.delete(key);
}
export function cacheResult(key: string, value: SummaryResponse) {
  if (results.size >= 100) results.delete(results.keys().next().value!);
  results.set(key, { value, expires: Date.now() + 10 * 60_000 });
  return value;
}
