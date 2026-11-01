import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registeredHosts } from '../apps/api/src/SiteRules_/hosts.ts';

test('기존 공용 규칙을 호스트 목록으로 이관하며 잘못된 데이터는 제외한다', async () => {
  const hosts = new Set(['new.example']);
  let completed = false, scans = 0;
  const rule = { origin: 'https://old.example', pathTemplate: '/board/{id}', idQuery: null,
    requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments',
    commentItem: '.row', commentText: '.text', replySelector: null };
  const redis = {
    get: async () => completed,
    scan: async () => { scans++; return ['0', ['old-key']]; },
    hgetall: async () => ({ valid: rule, invalid: { origin: 'https://invalid.example' } }),
    sadd: async (_key: string, host: string) => hosts.add(host),
    set: async () => { completed = true; },
    smembers: async () => [...hosts],
  };
  assert.deepEqual(await registeredHosts(redis as any), ['new.example', 'old.example']);
  assert.equal(completed, true);
  await registeredHosts(redis as any);
  assert.equal(scans, 1);
});
