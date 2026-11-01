import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupCandidates } from '../apps/extension/src/Sites_/shared.ts';

const data: Record<string, any> = {};
const requests: { url: string; init: RequestInit }[] = [];
let offline = false;
Object.assign(globalThis, { chrome: { storage: { local: {
  get: async (key: string) => ({ [key]: structuredClone(data[key]) }),
  set: async (value: object) => Object.assign(data, structuredClone(value)),
} } } });
globalThis.fetch = (async (url: string, init: RequestInit) => {
  requests.push({ url, init });
  if (offline) throw new Error('offline');
  return { ok: true, json: async () => url.endsWith('/hosts') ? { hosts: ['known.example'] } : { rule: null, rules: [] } };
}) as any;

test('동의 전 요청 차단, 무관한 사이트 URL 미전송, 등록 사이트만 자동 조회', async () => {
  await assert.rejects(lookupCandidates('https://private.example/secret'));
  await assert.rejects(lookupCandidates('https://private.example/secret', true));
  assert.equal(requests.length, 0);
  data['dataConsent:v1'] = true;
  await Promise.all(['private.example', 'other.example'].map(host => lookupCandidates(`https://${host}/secret`)));
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/site-rules\/hosts$/);
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.referrerPolicy, 'no-referrer');
  assert.doesNotMatch(JSON.stringify(requests), /private\.example|other\.example|secret/);
  await lookupCandidates('https://known.example/board/1');
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /\/lookup$/);
  await lookupCandidates('https://another.example/page');
  assert.equal(requests.length, 2);
  data['dataConsent:v1'] = false;
  await assert.rejects(lookupCandidates('https://known.example/board/2'));
  assert.equal(requests.length, 2);
});

test('목록 실패 시 URL 조회로 우회하지 않고 재시도 간격을 지킨다', async () => {
  data['dataConsent:v1'] = true;
  data['hostCatalog:v1'].at = 0;
  offline = true;
  const before = requests.length;
  await lookupCandidates('https://unknown.example/private');
  await lookupCandidates('https://second.example/private');
  assert.equal(requests.length, before + 1);
  assert.match(requests.at(-1)!.url, /\/hosts$/);
  offline = false;
  await lookupCandidates('https://unknown.example/post/1', true);
  assert.match(requests.at(-1)!.url, /\/lookup$/);
});
