import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { registerSummarize } from './Summarize_/Summarize.js';
import { registerSiteRules } from './SiteRules_/SiteRules.js';
import { registerAccess } from './Access_/Access.js';

if (!process.env.VERCEL) config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const app = Fastify({ logger: false, bodyLimit: 400_000 });
await app.register(rateLimit, { max: 20, timeWindow: '1 minute' });
app.addHook('onRequest', async (request, reply) => {
  if (request.method === 'GET' && request.url === '/health') return;
  const origin = request.headers.origin;
  const validOrigin = !origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
  if (request.headers['x-community-summary'] !== '1' || !validOrigin)
    return reply.code(403).send({ error: '확장기능을 통해 요청해 주세요.' });
});
app.setErrorHandler((error, _request, reply) => {
  const status = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode : 500;
  reply.code(status).send({ error: status === 429 ? '잠시 후 다시 시도해 주세요.' : '요청을 처리하지 못했습니다.' });
});
registerSummarize(app);
registerAccess(app);
registerSiteRules(app);
app.get('/health', async () => ({ status: 'ok' }));
export default app;
