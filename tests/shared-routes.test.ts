import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { registerSharedRules } from '../apps/api/src/SiteRules_/shared.ts';
import type { RuleStore } from '../apps/api/src/SiteRules_/store.ts';

test('공용 조회와 승인: 잘못된 입력 거절, 없는 규칙과 저장소 장애 구분', async () => {
  const app = Fastify();
  let fails = false;
  const store: RuleStore = { find: async () => { if (fails) throw new Error(); return null; },
    stage: async () => '', confirm: async (id, url) => id === '12345678-1234-4234-8234-123456789abc' && url.endsWith('/123') };
  registerSharedRules(app, store);
  try {
    const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload });
    assert.equal((await post('/site-rules/lookup', { url: 'file:///private' })).statusCode, 400);
    assert.deepEqual((await post('/site-rules/lookup', { url: 'https://example.com/123' })).json(), { rule: null });
    assert.equal((await post('/site-rules/confirm', { url: 'https://example.com/123', rule: {} })).statusCode, 400);
    assert.equal((await post('/site-rules/confirm', { url: 'https://example.com/456', candidateId: '12345678-1234-4234-8234-123456789abc' })).statusCode, 400);
    assert.equal((await post('/site-rules/confirm', { url: 'https://example.com/123', candidateId: '12345678-1234-4234-8234-123456789abc' })).statusCode, 200);
    fails = true;
    assert.equal((await post('/site-rules/lookup', { url: 'https://example.com/123' })).statusCode, 503);
  } finally { await app.close(); }
});
