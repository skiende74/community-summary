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

test('새 확장에는 공통·게시판 묶음 제공, 이전 확장은 기존 조회 유지', async () => {
  const common = { origin: 'https://example.com', pathTemplate: '/b/{board}/{id}', idQuery: null,
    requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments', commentItem: '.row', commentText: '.text', replySelector: null };
  const board = { ...common, pathTemplate: '/b/news/{id}' };
  const app = Fastify();
  registerSharedRules(app, { find: async () => board, list: async () => [common, board],
    stage: async () => '', confirm: async () => false });
  try {
    const url = 'https://example.com/b/news/1';
    const post = (payload: object) => app.inject({ method: 'POST', url: '/site-rules/lookup', payload });
    assert.deepEqual((await post({ url })).json(), { rule: board });
    assert.deepEqual((await post({ url, includeSiteRules: true })).json(), { rule: board, rules: [common, board] });
  } finally { await app.close(); }
});
