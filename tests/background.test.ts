import assert from 'node:assert/strict';
import { test } from 'node:test';

const rule = { origin: 'https://www.clien.net', pathTemplate: '/service/board/park/{id}', idQuery: null,
  requiredQuery: [], title: 'h3', body: 'article', commentsRoot: '.comments', commentItem: '.row', commentText: '.text', replySelector: null };
const url = 'https://www.clien.net/service/board/park/123';
const data: Record<string, unknown> = {};
let permitted = true, count = 2, fetchCount = 0;
let scripts: any[] = [];
let listener: any;
const event = { addListener() {} };
Object.assign(globalThis, { chrome: {
  runtime: { id: 'test', getURL: (path: string) => `chrome-extension://test/${path}`,
    onInstalled: event, onStartup: event, onMessage: { addListener(fn: any) { listener = fn; } } },
  permissions: { contains: async () => permitted, onRemoved: event },
  tabs: { get: async () => ({ url }), sendMessage: async () => ({ count, url }) },
  storage: { local: { get: async (key: string) => ({ [key]: data[key] }), set: async (value: object) => Object.assign(data, value) } },
  scripting: { getRegisteredContentScripts: async () => scripts,
    registerContentScripts: async (value: any[]) => { scripts = value; },
    updateContentScripts: async (value: any[]) => { scripts = value; },
    unregisterContentScripts: async () => { scripts = []; } },
} });
globalThis.fetch = (async () => { fetchCount++; return { ok: true, json: async () => ({ summary: '테스트 요약', count: 1 }) }; }) as any;
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
  assert.deepEqual(scripts[0].matches, ['https://www.clien.net/*']);
  assert.equal((await send(summarize, page)).result.summary, '테스트 요약');
  assert.equal(fetchCount, 1);
  permitted = false;
  assert.ok((await send(summarize, page)).error);
  assert.equal(fetchCount, 1);
  permitted = true;
  assert.ok((await send({ ...save, url: url + '4' })).error);
  assert.ok((await send({ type: 'generate-rule' }, page)).error);
  assert.equal((await send({ ...save, type: 'delete-rule' })).ok, true);
  assert.equal(scripts.length, 0);
  assert.ok((await send(summarize, page)).error);
});
