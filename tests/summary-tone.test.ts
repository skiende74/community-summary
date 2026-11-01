import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestSchema } from '../packages/contracts/src/index.ts';
import { cacheKey, cacheResult, getCached } from '../apps/api/src/Summarize_/cache.ts';
import { resolveTone } from '../apps/api/src/Summarize_/tone.ts';
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
test('미설정과 잘못된 설정은 서버 기본값을 따르고 저장된 선택은 유지', async () => {
  let saved: Record<string, unknown> = {};
  Object.assign(globalThis, { chrome: { storage: { local: { get: async (defaults: object) => ({ ...defaults, ...saved }) } } } });
  assert.equal((await readSettings()).tone, 'default');
  saved = { tone: 'invalid', enabled: false };
  assert.equal((await readSettings()).tone, 'default');
  assert.equal((await readSettings()).enabled, false);
  saved = { tone: 'brief' };
  assert.equal((await readSettings()).tone, 'brief');
});

test('서버 기본 말투 변경은 미지정 요청과 캐시에 반영하고 명시적 선택은 유지', () => {
  const previous = process.env.SUMMARY_DEFAULT_TONE;
  try {
    process.env.SUMMARY_DEFAULT_TONE = 'brief';
    assert.equal(resolveTone(), 'brief');
    assert.equal(resolveTone('haeyo'), 'haeyo');
    assert.equal(cacheKey(input), cacheKey({ ...input, tone: 'brief' }));
    process.env.SUMMARY_DEFAULT_TONE = 'formal';
    assert.equal(resolveTone(), 'formal');
    assert.notEqual(cacheKey(input), cacheKey({ ...input, tone: 'brief' }));
    process.env.SUMMARY_DEFAULT_TONE = 'invalid';
    assert.equal(resolveTone(), 'haeyo');
  } finally {
    if (previous === undefined) delete process.env.SUMMARY_DEFAULT_TONE;
    else process.env.SUMMARY_DEFAULT_TONE = previous;
  }
});
