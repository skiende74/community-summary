import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const digest = (value: string) => createHash('sha256').update(value).digest();
export function isAdmin(request: Pick<FastifyRequest, 'headers'>): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = request.headers.authorization;
  return !!expected && expected.length >= 32 && typeof supplied === 'string'
    && timingSafeEqual(digest(supplied), digest(`Bearer ${expected}`));
}
export function registerAccess(app: FastifyInstance) {
  app.post('/admin/verify', async (request, reply) => isAdmin(request)
    ? { ok: true } : reply.code(401).send({ error: '관리자 토큰을 확인해 주세요.' }));
}
