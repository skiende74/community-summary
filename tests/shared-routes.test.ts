import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { registerSiteRules } from '../apps/api/src/SiteRules_/SiteRules.ts';
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
    assert.deepEqual((await post('/site-rules/lookup', { url: 'https://example.com/123' })).json(), { rule: null, refreshAfterSeconds: 86400 });
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
    assert.deepEqual((await post({ url })).json(), { rule: board, refreshAfterSeconds: 86400 });
    assert.deepEqual((await post({ url, includeSiteRules: true })).json(), { rule: board, rules: [common, board], refreshAfterSeconds: 86400 });
  } finally { await app.close(); }
});

test('서버 환경변수로 조회 주기를 바꾸고 잘못된 값은 하루로 대체', async () => {
  const previous = process.env.SITE_RULE_REFRESH_SECONDS;
  const app = Fastify();
  registerSharedRules(app, { find: async () => null, stage: async () => '', confirm: async () => false });
  try {
    for (const [value, expected] of [['604800', 604800], ['0', 86400], ['invalid', 86400]] as const) {
      process.env.SITE_RULE_REFRESH_SECONDS = value;
      const response = await app.inject({ method: 'POST', url: '/site-rules/lookup', payload: { url: 'https://example.com/1' } });
      assert.equal(response.json().refreshAfterSeconds, expected);
    }
  } finally {
    if (previous === undefined) delete process.env.SITE_RULE_REFRESH_SECONDS;
    else process.env.SITE_RULE_REFRESH_SECONDS = previous;
    await app.close();
  }
});

test('공통 규칙 교체는 관리자 인증 후에만 저장소로 전달한다', async () => {
  const previous = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'admin-test-token-'.repeat(4);
  let calls = 0;
  const app = Fastify();
  registerSharedRules(app, { find: async () => null, stage: async () => '',
    confirm: async (_id, _url, replace) => { calls++; assert.equal(replace, true); return true; } });
  const payload = { url: 'https://example.com/b/news/1', candidateId: '12345678-1234-4234-8234-123456789abc', replaceSite: true };
  try {
    for (const authorization of [undefined, 'Bearer invalid']) {
      const response = await app.inject({ method: 'POST', url: '/site-rules/confirm', payload,
        headers: authorization ? { authorization } : {} });
      assert.equal(response.statusCode, 401);
    }
    assert.equal(calls, 0);
    const response = await app.inject({ method: 'POST', url: '/site-rules/confirm', payload,
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } });
    assert.equal(response.statusCode, 200);
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previous;
    await app.close();
  }
});

test('일반 사용자는 공통 규칙 재생성 경로에 진입할 수 없다', async () => {
  const app = Fastify();
  registerSiteRules(app);
  try {
    const response = await app.inject({ method: 'POST', url: '/site-rules',
      payload: { url: 'https://example.com/b/news/1', html: 'x'.repeat(100), mode: 'auto', replaceSite: true } });
    assert.equal(response.statusCode, 401);
  } finally { await app.close(); }
});
