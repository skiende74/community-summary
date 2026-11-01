import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupShared, lookupCandidates, rememberRule } from '../apps/extension/src/Sites_/shared.ts';
import type { SiteRule } from '../packages/contracts/src/index.ts';

const rule: SiteRule = { origin: 'https://example.com', pathTemplate: '/board/{board}/{id}', idQuery: null,
  requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments', commentItem: '.row', commentText: '.text', replySelector: null };
const data: Record<string, any> = {};
let refreshAfterSeconds: number | undefined;
let requests = 0, failure = false, found: SiteRule[] = [rule];
Object.assign(globalThis, { chrome: { storage: { local: {
  get: async (key: string) => ({ [key]: structuredClone(data[key]) }),
  set: async (value: object) => Object.assign(data, structuredClone(value)),
} } } });
globalThis.fetch = (async () => {
  requests++;
  await new Promise(resolve => setTimeout(resolve, 5));
  if (failure) throw new Error('offline');
  return { ok: true, json: async () => ({ rule: found[0] || null, rules: found, refreshAfterSeconds }) };
}) as any;

test('사이트당 24시간 한 번 조회하고 다른 게시판도 캐시로 적용, 수동 조회는 갱신', async () => {
  const results = await Promise.all([lookupShared('https://example.com/board/park/1'), lookupShared('https://example.com/board/news/2')]);
  assert.equal(requests, 1);
  assert.deepEqual(results, [rule, rule]);
  await lookupShared('https://example.com/board/new/3');
  assert.equal(requests, 1);
  await lookupShared('https://example.com/board/park/3', undefined, true);
  assert.equal(requests, 2);
  data['siteRuleChecks:v2']['https://example.com'].at -= 86400001;
  await lookupShared('https://example.com/board/park/4');
  assert.equal(requests, 3);
});
test('규칙 없음과 네트워크 실패도 다른 게시글에서 반복 자동 조회하지 않는다', async () => {
  found = [];
  assert.equal(await lookupShared('https://missing.example/board/1'), null);
  const before = requests;
  await lookupShared('https://missing.example/another/2');
  assert.equal(requests, before);
  failure = true;
  await assert.rejects(lookupShared('https://offline.example/board/1'));
  const afterFailure = requests;
  assert.equal(await lookupShared('https://offline.example/other/2'), null);
  assert.equal(requests, afterFailure);
  failure = false;
});
test('게시판 예외를 먼저 반환하고 사이트 공통을 대안으로 유지', async () => {
  const specific = { ...rule, pathTemplate: '/board/park/{id}' };
  found = [rule, specific];
  assert.deepEqual(await lookupCandidates('https://example.com/board/park/5', true), [specific, rule]);
  const before = requests;
  assert.deepEqual(await lookupCandidates('https://example.com/board/news/5'), [rule]);
  assert.equal(requests, before);
});

test('서버의 7일 주기를 저장하고 로컬 저장에도 유지하며 만료 또는 수동 요청에만 조회', async () => {
  refreshAfterSeconds = 604800;
  await lookupCandidates('https://example.com/board/park/7', true);
  await rememberRule(rule);
  const cached = data['siteRuleChecks:v2']['https://example.com'];
  assert.equal(cached.refreshAfterSeconds, 604800);
  const before = requests;
  cached.at -= 6 * 86400000;
  await lookupCandidates('https://example.com/board/park/8');
  assert.equal(requests, before);
  cached.at -= 86400001;
  await lookupCandidates('https://example.com/board/park/9');
  assert.equal(requests, before + 1);
  await lookupCandidates('https://example.com/board/park/10', true);
  assert.equal(requests, before + 2);
});
