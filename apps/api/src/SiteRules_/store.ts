import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { matchRule, ruleScope, siteRuleSchema, type SiteRule } from '@summary/contracts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const boardKey = (origin: string) => `rules:v1:origin:${hash(origin)}`;
function client() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Rule storage unavailable');
  return new Redis({ url, token, retry: { retries: 0 }, signal: () => AbortSignal.timeout(4000) });
}
export interface RuleStore {
  find(url: string): Promise<SiteRule | null>;
  stage(rule: SiteRule): Promise<string>;
  confirm(id: string, url: string): Promise<boolean>;
}
export const ruleStore: RuleStore = {
  async find(url) {
    const entries = await client().hgetall<Record<string, unknown>>(boardKey(new URL(url).origin));
    return Object.values(entries || {}).flatMap(value => {
      const parsed = siteRuleSchema.safeParse(value);
      return parsed.success && matchRule(parsed.data, url) ? [parsed.data] : [];
    }).sort((a, b) => b.pathTemplate.length - a.pathTemplate.length || b.requiredQuery.length - a.requiredQuery.length)[0] || null;
  },
  async stage(rule) {
    const id = randomUUID();
    await client().set(`rules:v1:candidate:${id}`, rule, { ex: 86400 });
    return id;
  },
  async confirm(id, url) {
    const redis = client();
    const parsed = siteRuleSchema.safeParse(await redis.get(`rules:v1:candidate:${id}`));
    if (!parsed.success || !matchRule(parsed.data, url)) return false;
    // 클라이언트가 보낸 선택자를 저장하지 않고 서버가 생성한 후보만 승인한다.
    await redis.multi().hset(boardKey(parsed.data.origin), { [hash(ruleScope(parsed.data))]: parsed.data })
      .del(`rules:v1:candidate:${id}`).exec();
    return true;
  },
};
