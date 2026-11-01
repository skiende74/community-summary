import type { FastifyInstance } from 'fastify';
import { ruleLookupSchema, ruleConfirmSchema } from '@summary/contracts';
import { ruleStore, type RuleStore } from './store.js';

export function registerSharedRules(app: FastifyInstance, store: RuleStore = ruleStore) {
  app.post('/site-rules/lookup', async (request, reply) => {
    const parsed = ruleLookupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '게시글 URL이 올바르지 않습니다.' });
    try { return { rule: await store.find(parsed.data.url) }; }
    catch { return reply.code(503).send({ error: '공용 규칙을 조회하지 못했습니다.' }); }
  });
  app.post('/site-rules/confirm', async (request, reply) => {
    const parsed = ruleConfirmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '승인할 규칙이 올바르지 않습니다.' });
    try {
      if (!await store.confirm(parsed.data.candidateId, parsed.data.url))
        return reply.code(400).send({ error: '규칙 후보가 만료되었거나 게시판이 다릅니다.' });
      return { ok: true };
    } catch { return reply.code(503).send({ error: '공용 저장에 실패했습니다. 로컬 규칙은 유지됩니다.' }); }
  });
}
