import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupShared } from '../apps/extension/src/Sites_/shared.ts';
import type { SiteRule } from '../packages/contracts/src/index.ts';

const rule: SiteRule = { origin: 'https://example.com', pathTemplate: '/board/{id}', idQuery: null,
  requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments', commentItem: '.row', commentText: '.text', replySelector: null };
const data: Record<string, any> = {};
let requests = 0, failure = false, found: SiteRule | null = rule;
Object.assign(globalThis, { chrome: { storage: { local: {
  get: async (key: string) => ({ [key]: structuredClone(data[key]) }),
  set: async (value: object) => Object.assign(data, structuredClone(value)),
} } } });
globalThis.fetch = (async () => {
  requests++;
  await new Promise(resolve => setTimeout(resolve, 5));
  if (failure) throw new Error('offline');
  return { ok: true, json: async () => ({ rule: found }) };
}) as any;
test('게시판별 24시간 제한, 동시 요청 합치기, 명시적 설정은 즉시 조회', async () => {
  const results = await Promise.all([lookupShared('https://example.com/board/1', rule), lookupShared('https://example.com/board/2', rule)]);
  assert.equal(requests, 1);
  assert.deepEqual(results, [rule, rule]);
  await lookupShared('https://example.com/board/3', rule);
  assert.equal(requests, 1);
  await lookupShared('https://example.com/board/3', rule, true);
  assert.equal(requests, 2);
  for (const check of Object.values(data['siteRuleChecks:v1']) as any[]) check.at -= 86400001;
  await lookupShared('https://example.com/board/4', rule);
  assert.equal(requests, 3);
});
test('규칙 없음과 네트워크 실패도 반복 자동 조회를 막는다', async () => {
  const other = { ...rule, pathTemplate: '/other/{id}' };
  found = null;
  assert.equal(await lookupShared('https://example.com/other/1', other), null);
  const afterMissing = requests;
  await lookupShared('https://example.com/other/2', other);
  assert.equal(requests, afterMissing);
  failure = true;
  const third = { ...rule, pathTemplate: '/third/{id}' };
  await assert.rejects(lookupShared('https://example.com/third/1', third));
  const afterFailure = requests;
  await lookupShared('https://example.com/third/2', third);
  assert.equal(requests, afterFailure);
  failure = false; found = rule;
});
test('다른 게시판을 동시에 조회해도 조회 시각이 유실되지 않음', async () => {
  const a = { ...rule, pathTemplate: '/a/{id}' }, b = { ...rule, pathTemplate: '/b/{id}' };
  await Promise.all([lookupShared('https://example.com/a/1', a), lookupShared('https://example.com/b/1', b)]);
  const before = requests;
  await Promise.all([lookupShared('https://example.com/a/2', a), lookupShared('https://example.com/b/2', b)]);
  assert.equal(requests, before);
});
