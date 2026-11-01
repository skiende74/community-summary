import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { allowRuleGeneration, ruleBuckets } from '../apps/api/src/Access_/RuleQuota.ts';

const id = '12345678-1234-4234-8234-123456789abc';
test('설치별 총량과 호스트별 한도를 분리하고 포트·경로로 우회하지 못함', () => {
  const base = ruleBuckets(id, 'https://www.example.com/board/1');
  assert.deepEqual(base.map(item => item.limit), [10, 10]);
  assert.deepEqual(base, ruleBuckets(id.toUpperCase(), 'https://WWW.example.com.:443/other/2'));
  assert.equal(base[0].key, ruleBuckets(id, 'https://m.example.com/1')[0].key);
  assert.notEqual(base[1].key, ruleBuckets(id, 'https://m.example.com/1')[1].key);
  assert.notEqual(base[0].key, ruleBuckets('22345678-1234-4234-8234-123456789abc', 'https://www.example.com')[0].key);
});

test('한도 초과·저장소 장애·잘못된 관리자 인증은 LLM 단계 전에 차단', async () => {
  const original = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'test-only-admin-token-'.repeat(3);
  let retry = 0, fail = false, consumed = 0, modelCalls = 0;
  const app = Fastify();
  app.post('/generate', async (request, reply) => {
    if (!await allowRuleGeneration(request, reply, 'https://example.com/post/1', async () => {
      consumed++;
      if (fail) throw new Error('Unavailable');
      return retry;
    })) return;
    modelCalls++;
    return { ok: true };
  });
  const send = (headers: Record<string, string> = { 'x-installation-id': id }) =>
    app.inject({ method: 'POST', url: '/generate', headers });
  try {
    assert.equal((await send({})).statusCode, 400);
    assert.equal(consumed, 0);
    assert.equal((await send()).statusCode, 200);
    retry = 3600;
    const limited = await send();
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '3600');
    assert.equal(modelCalls, 1);
    fail = true;
    assert.equal((await send()).statusCode, 503);
    assert.equal(modelCalls, 1);
    const before = consumed;
    assert.equal((await send({ authorization: 'Bearer wrong' })).statusCode, 401);
    assert.equal((await send({ authorization: `Bearer ${process.env.ADMIN_TOKEN}` })).statusCode, 200);
    assert.equal(consumed, before); // 관리자만 저장소 장애와 일일 한도에서 면제
    assert.equal(modelCalls, 2);
  } finally {
    if (original === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = original;
    await app.close();
  }
});
