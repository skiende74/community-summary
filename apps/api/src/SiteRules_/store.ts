import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { isSiteRule, matchingRules, matchRule, ruleScope, siteRuleSchema, type SiteRule } from '@summary/contracts';
import { hostsKey, registeredHosts } from './hosts.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const boardKey = (origin: string) => `rules:v1:origin:${hash(origin)}`;
function client() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Rule storage unavailable');
  return new Redis({ url, token, retry: { retries: 0 }, signal: () => AbortSignal.timeout(4000) });
}
export interface RuleStore {
  hosts?(): Promise<string[]>;
  find(url: string): Promise<SiteRule | null>;
  list?(url: string): Promise<SiteRule[]>;
  stage(rule: SiteRule): Promise<string>;
  confirm(id: string, url: string, replaceSite?: boolean): Promise<boolean>;
}
async function list(url: string) {
  const origin = new URL(url).origin;
  const entries = await client().hgetall<Record<string, unknown>>(boardKey(origin));
  return Object.values(entries || {}).flatMap(value => {
    const parsed = siteRuleSchema.safeParse(value);
    return parsed.success && parsed.data.origin === origin ? [parsed.data] : [];
  }).sort((a, b) => Number(isSiteRule(b)) - Number(isSiteRule(a))).slice(0, 100);
}
export const ruleStore: RuleStore = {
  hosts: () => registeredHosts(client()),
  list,
  async find(url) { return matchingRules((await list(url)).filter(rule => !isSiteRule(rule)), url)[0] || null; },
  async stage(rule) {
    const id = randomUUID();
    await client().set(`rules:v1:candidate:${id}`, rule, { ex: 86400 });
    return id;
  },
  async confirm(id, url, replaceSite = false) {
    const redis = client();
    const parsed = siteRuleSchema.safeParse(await redis.get(`rules:v1:candidate:${id}`));
    if (!parsed.success || !matchRule(parsed.data, url)) return false;
    // 클라이언트가 보낸 선택자를 저장하지 않고 서버가 생성한 후보만 승인한다.
    const rule = parsed.data;
    if (replaceSite && !isSiteRule(rule)) return false;
    const field = isSiteRule(rule) ? 'site-default:v1' : hash(ruleScope(rule));
    // 최초 공통 규칙은 원자적으로 고정하고, 인증된 관리자 교체만 덮어쓰기를 허용한다.
    const transaction = redis.multi();
    if (isSiteRule(rule) && !replaceSite) transaction.hsetnx(boardKey(rule.origin), field, rule);
    else transaction.hset(boardKey(rule.origin), { [field]: rule });
    const result = await transaction.sadd(hostsKey, new URL(rule.origin).hostname).del(`rules:v1:candidate:${id}`).exec();
    return replaceSite || !isSiteRule(rule) || result[0] === 1;
  },
};
