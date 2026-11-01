import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { refreshShared } from '../apps/extension/src/Sites_/refresh.ts';
import { readRules, setDisabled, sourceKey, ruleScope } from '../apps/extension/src/Sites_/rules.ts';
import { syncScripts, hasSiteAccess } from '../apps/extension/src/Sites_/registration.ts';
import type { SiteRule } from '../packages/contracts/src/index.ts';

const common: SiteRule = { origin: 'https://auto.example', pathTemplate: '/board/{board}/{id}',
  idQuery: null, requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments',
  commentItem: '.row', commentText: '.text', replySelector: null };
const data: Record<string, any> = { 'dataConsent:v1': true, 'hostCatalog:v1': { hosts: ['auto.example'], at: Date.now(), retryAt: 0 } };
const manifest = JSON.parse(readFileSync(new URL('../apps/extension/public/manifest.json', import.meta.url), 'utf8'));
let origins = ['https://auto.example/*'];
let permitted = true, href = 'https://auto.example/board/park/1', fetches = 0, previews = 0;
let scripts: any[] = [{ id: 'approved-sites', matches: ['https://auto.example/*'] }];
Object.assign(globalThis, { chrome: {
  runtime: { getManifest: () => manifest },
  storage: { local: {
    get: async (key: string | object) => typeof key === 'string' ? { [key]: data[key] } : { ...key, ...data },
    set: async (value: object) => Object.assign(data, structuredClone(value)),
  } },
  permissions: { contains: async () => permitted, getAll: async () => ({ origins }) },
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

test('허용한 추가 사이트에 동적 스크립트를 유지하고 공통 규칙 자동 적용', async () => {
  await syncScripts();
  assert.deepEqual(scripts[0].matches, ['https://auto.example/*']);
  await syncScripts();
  assert.deepEqual(scripts[0].matches, ['https://auto.example/*']);
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

test('기본 10개 사이트만 정적 접근하고 나머지는 선택 권한으로 선언한다', () => {
  assert.equal(manifest.content_scripts[0].matches.length, 10);
  assert.ok(!manifest.host_permissions.includes('https://*/*'));
  assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
  assert.ok(manifest.permissions.includes('activeTab'));
});
test('임시 탭 권한과 이전 전체 권한은 자동 접근으로 취급하지 않고 회수 시 스크립트를 제거한다', async () => {
  assert.equal(await hasSiteAccess('https://auto.example/1'), true);
  assert.equal(await hasSiteAccess('https://other.example/1'), false);
  origins = ['https://*/*', ...manifest.host_permissions];
  assert.equal(await hasSiteAccess('https://other.example/1'), false);
  await syncScripts();
  assert.deepEqual(scripts, []);
  assert.equal(await hasSiteAccess('https://www.clien.net/1'), true);
});
