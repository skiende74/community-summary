import { resolveTone } from './tone.js';
import type { FastifyInstance } from 'fastify';
import { requestSchema } from '@summary/contracts';
import { summarize } from './llm.js';
import { cacheKey, cacheResult, getCached, pending } from './cache.js';

export function registerSummarize(app: FastifyInstance) {
  app.post('/summarize', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '요약할 댓글 데이터가 올바르지 않습니다.' });
    if (!process.env.OPENAI_API_KEY)
      return reply.code(503).send({ error: '요약 서버 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.' });
    const input = { ...parsed.data, tone: resolveTone(parsed.data.tone) };
    const key = cacheKey(input);
    const cached = getCached(key);
    if (cached && request.headers['x-summary-refresh'] !== '1') return cached;
    if (!pending.has(key) && pending.size >= 2)
      return reply.code(429).send({ error: '다른 요약을 처리 중입니다. 잠시 후 다시 시도해 주세요.' });
    try {
      let work = pending.get(key);
      if (!work) {
        work = summarize(input).then(value => cacheResult(key, value))
          .finally(() => pending.delete(key));
        pending.set(key, work);
      }
      return await work;
    } catch {
      return reply.code(502).send({ error: '요약 생성에 실패했습니다. API 키·모델 접근 권한·사용 한도를 확인하고 다시 시도해 주세요.' });
    }
  });
}
