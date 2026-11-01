import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { isAdmin, registerAccess } from '../apps/api/src/Access_/Access.ts';

test('관리자는 서버 비밀값이 설정되고 정확히 일치할 때만 인정', async () => {
  const original = process.env.ADMIN_TOKEN;
  const app = Fastify();
  registerAccess(app);
  try {
    delete process.env.ADMIN_TOKEN;
    assert.equal(isAdmin({ headers: { authorization: 'Bearer anything' } }), false);
    process.env.ADMIN_TOKEN = 'test-only-admin-token-'.repeat(3);
    assert.equal(isAdmin({ headers: {} }), false);
    assert.equal(isAdmin({ headers: { authorization: 'Bearer wrong' } }), false);
    assert.equal(isAdmin({ headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } }), true);
    assert.equal((await app.inject({ method: 'POST', url: '/admin/verify' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/admin/verify',
      headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } })).statusCode, 200);
  } finally {
    if (original === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = original;
    await app.close();
  }
});
