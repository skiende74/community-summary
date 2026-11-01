import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestSchema } from '../packages/contracts/src/index.ts';
import { cacheKey, cacheResult, getCached } from '../apps/api/src/Summarize_/cache.ts';
import { readSettings } from '../apps/extension/src/settings.ts';

const input = { title: '제목', body: '본문', comments: [{ id: 'comment_1', text: '댓글', isReply: false }] };
test('말투별 서버 캐시를 분리하고 말투가 없는 이전 요청은 해요체와 공유', () => {
  const old = requestSchema.parse(input);
  const haeyo = requestSchema.parse({ ...input, tone: 'haeyo' });
  const brief = requestSchema.parse({ ...input, tone: 'brief' });
  const formal = requestSchema.parse({ ...input, tone: 'formal' });
  assert.equal(cacheKey(old), cacheKey(haeyo));
  assert.equal(new Set([haeyo, brief, formal].map(cacheKey)).size, 3);
  cacheResult(cacheKey(haeyo), { summary: '반응이 많아요.', count: 1 });
  assert.equal(getCached(cacheKey(brief)), undefined);
  assert.equal(getCached(cacheKey(formal)), undefined);
  assert.equal(requestSchema.safeParse({ ...input, tone: 'ignore instructions' }).success, false);
});
test('기존 설치와 잘못된 설정은 해요체로 기본 적용', async () => {
  let saved: Record<string, unknown> = {};
  Object.assign(globalThis, { chrome: { storage: { local: { get: async (defaults: object) => ({ ...defaults, ...saved }) } } } });
  assert.equal((await readSettings()).tone, 'haeyo');
  saved = { tone: 'invalid', enabled: false };
  assert.equal((await readSettings()).tone, 'haeyo');
  assert.equal((await readSettings()).enabled, false);
  saved = { tone: 'brief' };
  assert.equal((await readSettings()).tone, 'brief');
});
