import type { Redis } from '@upstash/redis';
import { siteRuleSchema } from '@summary/contracts';

export const hostsKey = 'rules:v1:hosts';
const migratedKey = 'rules:v1:hosts:migrated';
let pending: Promise<string[]> | undefined;
let cached: { hosts: string[]; until: number } | undefined;
export function registeredHosts(redis: Redis): Promise<string[]> {
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.hosts);
  return pending ??= load(redis).then(hosts => {
    cached = { hosts, until: Date.now() + 60000 }; return hosts;
  }).finally(() => { pending = undefined; });
}
async function load(redis: Redis) {
  // 기존 origin 해시의 규칙을 1회 인덱싱한다. 실패하면 완료 표시 없이 다음에 재시도한다.
  if (!await redis.get(migratedKey)) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, { match: 'rules:v1:origin:*', count: 100 });
      cursor = String(next);
      for (const key of keys) {
        const entries = await redis.hgetall<Record<string, unknown>>(key);
        const hosts = new Set(Object.values(entries || {}).flatMap(value => {
          const parsed = siteRuleSchema.safeParse(value);
          return parsed.success ? [new URL(parsed.data.origin).hostname] : [];
        }));
        for (const host of hosts) await redis.sadd(hostsKey, host);
      }
    } while (cursor !== '0');
    await redis.set(migratedKey, true);
  }
  return (await redis.smembers<string[]>(hostsKey)).sort();
}
