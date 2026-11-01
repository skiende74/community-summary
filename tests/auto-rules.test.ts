import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { refreshShared } from '../apps/extension/src/Sites_/refresh.ts';
import { readRules, setDisabled, sourceKey, ruleScope } from '../apps/extension/src/Sites_/rules.ts';
import { syncScripts } from '../apps/extension/src/Sites_/registration.ts';
import type { SiteRule } from '../packages/contracts/src/index.ts';

const common: SiteRule = { origin: 'https://auto.example', pathTemplate: '/board/{board}/{id}',
  idQuery: null, requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments',
  commentItem: '.row', commentText: '.text', replySelector: null };
const data: Record<string, any> = { 'dataConsent:v1': true, 'hostCatalog:v1': { hosts: ['auto.example'], at: Date.now(), retryAt: 0 } };
let permitted = true, href = 'https://auto.example/board/park/1', fetches = 0, previews = 0;
let scripts: any[] = [{ id: 'approved-sites', matches: ['https://auto.example/*'] }];
Object.assign(globalThis, { chrome: {
  storage: { local: {
    get: async (key: string | object) => typeof key === 'string' ? { [key]: data[key] } : { ...key, ...data },
    set: async (value: object) => Object.assign(data, structuredClone(value)),
  } },
  permissions: { contains: async () => permitted, getAll: async () => ({ origins: ['https://auto.example/*'] }) },
  tabs: { get: async () => ({ url: href }), sendMessage: async () => { previews++; return { count: 2, url: href }; } },
  scripting: { getRegisteredContentScripts: async () => scripts,
    registerContentScripts: async (value: any[]) => { scripts = value; },
    updateContentScripts: async (value: any[]) => { scripts = value; },
    unregisterContentScripts: async () => { scripts = []; } },
} });
globalThis.fetch = (async (url: string) => {
  assert.match(url, /site-rules\/lookup$/); // 자동 적용은 LLM 생성 엔드포인트를 호출하지 않는다.
  fetches++;
  return { ok: true, json: async () => ({ rule: common, rules: [common] }) };
}) as any;
const sender = () => ({ url: href, tab: { id: 1 }, frameId: 0 } as chrome.runtime.MessageSender);

test('이전 동적 스크립트 제거 후 로컬 규칙 없이 공통 규칙 자동 적용', async () => {
  await syncScripts();
  assert.deepEqual(scripts, []);
  await syncScripts();
  assert.deepEqual(scripts, []);
  assert.equal((await refreshShared(sender())).kind, 'ok');
  assert.equal((await readRules()).length, 1);
  assert.equal(data[sourceKey][ruleScope(common)].source, 'shared');
  assert.equal(fetches, 1);
  href = 'https://auto.example/board/news/2';
  assert.equal((await refreshShared(sender())).kind, 'ok');
  assert.equal(fetches, 1);
});
test('적용 해제와 권한 회수 후 자동으로 다시 적용하지 않는다', async () => {
  await setDisabled(common, href, true);
  const before = previews;
  assert.equal((await refreshShared(sender())).kind, 'disabled');
  assert.equal(previews, before);
  href = 'https://auto.example/board/park/3';
  assert.equal((await refreshShared(sender())).kind, 'ok');
  permitted = false;
  assert.equal((await refreshShared(sender())).kind, 'error');
  assert.equal(fetches, 1);
});

test('설치 권한과 정적 주입 범위가 HTTPS 전체이며 API 서버는 제외한다', () => {
  const manifest = JSON.parse(readFileSync(new URL('../apps/extension/public/manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.host_permissions.includes('https://*/*'));
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://*/*']);
  assert.ok(manifest.content_scripts[0].exclude_matches.includes('https://community-summary-api.vercel.app/*'));
});
