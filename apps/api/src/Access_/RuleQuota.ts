import type { FastifyReply, FastifyRequest } from 'fastify';
import { isAdmin } from './Access.js';
import { consumeQuota, hashIdentity, type QuotaBucket } from './quota.js';

export function ruleBuckets(installation: string, url: string): QuotaBucket[] {
  const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  const prefix = `rule-quota:v1:${hashIdentity(installation.toLowerCase())}`;
  return [{ key: `${prefix}:all`, limit: 10 }, { key: `${prefix}:host:${hashIdentity(host)}`, limit: 10 }];
}
export async function allowRuleGeneration(request: FastifyRequest, reply: FastifyReply, url: string,
  consume: typeof consumeQuota = consumeQuota): Promise<boolean> {
  if (isAdmin(request)) return true;
  if (request.headers.authorization) {
    reply.code(401).send({ error: '관리자 인증이 만료되었거나 올바르지 않습니다. 설정에서 다시 인증하거나 해제해 주세요.' });
    return false;
  }
  const installation = request.headers['x-installation-id'];
  if (typeof installation !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(installation)) {
    reply.code(400).send({ error: '설치 정보를 확인하지 못했습니다. 확장프로그램을 최신 버전으로 업데이트해 주세요.' });
    return false;
  }
  try {
    const retryAfter = await consume(ruleBuckets(installation, url));
    if (!Number.isFinite(retryAfter) || retryAfter < 0) throw new Error('Invalid quota response');
    if (retryAfter > 0) {
      reply.header('Retry-After', String(retryAfter)).code(429).send({
        error: `규칙 생성은 최근 24시간에 총 10회, 같은 호스트에서 10회까지 가능합니다. 약 ${Math.ceil(retryAfter / 60)}분 후 다시 시도해 주세요.`,
      });
      return false;
    }
    return true;
  } catch {
    reply.code(503).send({ error: '사용 한도를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    return false;
  }
}
