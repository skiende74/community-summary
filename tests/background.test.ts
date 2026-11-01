import assert from 'node:assert/strict';
import { test } from 'node:test';

const rule = { origin: 'https://www.clien.net', pathTemplate: '/service/board/park/{id}', idQuery: null,
  requiredQuery: [], title: 'h3', body: 'article', commentsRoot: '.comments', commentItem: '.row', commentText: '.text', replySelector: null };
const url = 'https://www.clien.net/service/board/park/123';
const data: Record<string, unknown> = { 'dataConsent:v1': true, 'hostCatalog:v1': { hosts: [], at: Date.now(), retryAt: 0 } };
let permitted = true, count = 2, fetchCount = 0;
let lastPayload: any;
let scripts: any[] = [];
let listener: any, installed: any, optionsOpened = 0;
const event = { addListener() {} };
Object.assign(globalThis, { chrome: {
  runtime: { getManifest: () => ({ content_scripts: [], host_permissions: [] }), id: 'test', getURL: (path: string) => `chrome-extension://test/${path}`,
    openOptionsPage: async () => { optionsOpened++; },
    onInstalled: { addListener(fn: any) { installed = fn; } }, onStartup: event, onMessage: { addListener(fn: any) { listener = fn; } } },
  permissions: { contains: async () => permitted, getAll: async () => ({ origins: [] }), onRemoved: event, onAdded: event },
  tabs: { get: async () => ({ url }), sendMessage: async () => ({ count, url }) },
  storage: { local: { get: async (key: string | object) => typeof key === 'string' ? { [key]: data[key] } : { ...key, ...data }, set: async (value: object) => Object.assign(data, value) } },
  scripting: { getRegisteredContentScripts: async () => scripts,
    registerContentScripts: async (value: any[]) => { scripts = value; },
    updateContentScripts: async (value: any[]) => { scripts = value; },
    unregisterContentScripts: async () => { scripts = []; } },
} });
globalThis.fetch = (async (_url: string, init: RequestInit) => { fetchCount++; lastPayload = JSON.parse(init.body as string);
  return { ok: true, json: async () => ({ summary: '테스트 요약', count: 1 }) }; }) as any;
await import('../apps/extension/src/background.ts');
const popup = { id: 'test', url: 'chrome-extension://test/popup.html' };
const page = { id: 'test', url, tab: { id: 1 }, frameId: 0 };
const send = (message: object, sender = popup) => new Promise<any>(resolve => listener(message, sender, resolve));
const save = { type: 'save-rule', rule, tabId: 1, url };
const summarize = { type: 'summarize', payload: { title: '글', body: '본문', comments: [{ id: 'comment_1', text: '댓글', isReply: false }] } };

test('사이트 권한과 미리보기 승인 후에만 저장하고, 요약 요청 권한 확인', async () => {
  permitted = false;
  assert.ok((await send(save)).error);
  assert.equal(data['siteRules:v1'], undefined);
  permitted = true; count = 0;
  assert.ok((await send(save)).error);
  assert.equal(data['siteRules:v1'], undefined);
  count = 2;
  assert.equal((await send(save)).ok, true);
  assert.deepEqual(scripts, []);
  assert.equal((await send(summarize, page)).result.summary, '테스트 요약');
  assert.equal(fetchCount, 1);
  assert.equal(lastPayload.tone, undefined);
  permitted = false;
  assert.ok((await send(summarize, page)).error);
  assert.equal(fetchCount, 1);
  permitted = true;
  assert.ok((await send({ ...save, url: url + '4' })).error);
  assert.ok((await send({ type: 'generate-rule' }, page)).error);
  data.tone = 'formal';
  await send({ ...summarize, refresh: true }, page);
  assert.equal(lastPayload.tone, 'formal');
  data.tone = 'brief';
  await send(summarize, page);
  assert.equal(lastPayload.tone, 'brief');
  assert.equal((await send({ ...save, type: 'delete-rule' })).ok, true);
  assert.equal(scripts.length, 0);
  assert.ok((await send(summarize, page)).error);
});

test('관리자 교체는 서버 승인 실패 시 로컬 규칙을 바꾸지 않는다', async () => {
  const common = { ...rule, pathTemplate: '/service/board/{board}/{id}' };
  const before = structuredClone(data['siteRules:v1']);
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    assert.equal(JSON.parse(init.body as string).replaceSite, true);
    return { ok: false, status: 401 };
  }) as any;
  const result = await send({ ...save, rule: common, replaceSite: true,
    candidateId: '12345678-1234-4234-8234-123456789abc' });
  assert.ok(result.error);
  assert.deepEqual(data['siteRules:v1'], before);
});

test('동의를 철회하면 요약과 규칙 생성 요청이 네트워크 전에 차단된다', async () => {
  data['dataConsent:v1'] = false;
  const before = fetchCount;
  assert.ok((await send(summarize, page)).error);
  assert.ok((await send({ type: 'generate-rule' })).error);
  assert.equal(fetchCount, before);
});

test('최초 설치에만 동의 안내 설정 탭을 열고 업데이트에는 열지 않는다', () => {
  installed({ reason: 'install' });
  assert.equal(optionsOpened, 1);
  installed({ reason: 'update' });
  installed({ reason: 'chrome_update' });
  assert.equal(optionsOpened, 1);
});
