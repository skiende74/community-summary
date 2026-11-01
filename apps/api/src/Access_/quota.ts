import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

// Redis server time and one atomic script prevent parallel requests from exceeding either limit.
export const quotaScript = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = 86400000
local retry = 0
for i, key in ipairs(KEYS) do
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
  local limit = tonumber(ARGV[i + 1])
  local count = redis.call('ZCARD', key)
  if count >= limit then
    local oldest = redis.call('ZRANGE', key, count - limit, count - limit, 'WITHSCORES')
    retry = math.max(retry, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
  end
end
if retry > 0 then return retry end
for _, key in ipairs(KEYS) do
  redis.call('ZADD', key, now, ARGV[1])
  redis.call('EXPIRE', key, 86400)
end
return 0
`;
export type QuotaBucket = { key: string; limit: number };
export const hashIdentity = (value: string) => createHash('sha256').update(value).digest('hex');
export async function consumeQuota(buckets: QuotaBucket[]): Promise<number> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Quota storage unavailable');
  const redis = new Redis({ url, token, retry: { retries: 0 }, signal: () => AbortSignal.timeout(4000) });
  const result = await redis.eval(quotaScript, buckets.map(bucket => bucket.key),
    [randomUUID(), ...buckets.map(bucket => bucket.limit)]);
  if (typeof result !== 'number' || !Number.isInteger(result) || result < 0) throw new Error('Invalid quota result');
  return result;
}
