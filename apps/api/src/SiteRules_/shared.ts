import type { FastifyInstance } from 'fastify';
import { matchingRules, ruleLookupSchema, ruleConfirmSchema, ruleRefreshSecondsSchema } from '@summary/contracts';
import { ruleStore, type RuleStore } from './store.js';

export function registerSharedRules(app: FastifyInstance, store: RuleStore = ruleStore) {
  app.post('/site-rules/lookup', async (request, reply) => {
    const parsed = ruleLookupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '게시글 URL이 올바르지 않습니다.' });
    try {
      const refreshAfterSeconds = ruleRefreshSecondsSchema.parse(Number(process.env.SITE_RULE_REFRESH_SECONDS));
      if (parsed.data.includeSiteRules && store.list) {
        const rules = await store.list(parsed.data.url);
        return { rule: matchingRules(rules, parsed.data.url)[0] || null, rules, refreshAfterSeconds };
      }
      return { rule: await store.find(parsed.data.url), refreshAfterSeconds };
    }
    catch { return reply.code(503).send({ error: '공용 규칙을 조회하지 못했습니다.' }); }
  });
  app.post('/site-rules/confirm', async (request, reply) => {
    const parsed = ruleConfirmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '승인할 규칙이 올바르지 않습니다.' });
    try {
      if (!await store.confirm(parsed.data.candidateId, parsed.data.url))
        return reply.code(400).send({ error: '후보가 만료되었거나 범위가 다릅니다. 기존 사이트 공통 규칙은 덮어쓰지 않습니다.' });
      return { ok: true };
    } catch { return reply.code(503).send({ error: '공용 저장에 실패했습니다. 로컬 규칙은 유지됩니다.' }); }
  });
}
