import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { isSiteRule, matchRule, matchingRules, siteRuleSchema, specializeRule } from '../packages/contracts/src/index.ts';
import { supportedScope } from '../apps/api/src/SiteRules_/scope.ts';
import { inspect } from '../apps/extension/src/Sites_/Sites.ts';
import { snapshot } from '../apps/extension/src/Sites_/snapshot.ts';
import { previewRules } from '../apps/extension/src/Sites_/preview.ts';

const common = siteRuleSchema.parse({ origin: 'https://www.clien.net', pathTemplate: '/service/board/{board}/{id}',
  idQuery: null, requiredQuery: [], title: 'h1', body: 'article', commentsRoot: '.comments',
  commentItem: '.row', commentText: '.text', replySelector: null });
const park = 'https://www.clien.net/service/board/park/123';
const news = 'https://www.clien.net/service/board/news/123';
test('경로·쿼리형 사이트 공통 규칙, 게시판 예외 우선 및 목록 제외', () => {
  assert.equal(matchRule(common, park), '123');
  assert.equal(matchRule(common, news), '123');
  assert.equal(matchRule(common, park.replace('/123', '')), null);
  assert.equal(matchRule(common, park.replace('www.clien.net', 'other.example')), null);
  const board = specializeRule(common, park);
  assert.equal(isSiteRule(board), false);
  assert.deepEqual(matchingRules([common, board], park), [board, common]);
  assert.equal(matchRule(board, news), null);
  const query = siteRuleSchema.parse({ ...common, pathTemplate: '/bbs/board.php', idQuery: 'wr_id', boardQuery: 'bo_table' });
  assert.equal(matchRule(query, 'https://www.clien.net/bbs/board.php?bo_table=news&wr_id=123'), '123');
  assert.equal(matchRule(query, 'https://www.clien.net/bbs/board.php?wr_id=123'), null);
  assert.equal(siteRuleSchema.safeParse({ ...query, boardQuery: 'wr_id' }).success, false);
  assert.equal(siteRuleSchema.safeParse({ ...common, pathTemplate: '/{board}/{board}/{id}' }).success, false);
});
test('다른 게시판 링크 근거가 없으면 공통으로 확대하지 않고 맞춤 설정은 항상 좁힌다', () => {
  assert.equal(isSiteRule(supportedScope(common, { url: park, mode: 'auto', links: [park.replace('123', '456')] })), false);
  assert.equal(isSiteRule(supportedScope(common, { url: park, mode: 'auto', links: [news] })), true);
  assert.equal(isSiteRule(supportedScope(common, { url: park, mode: 'auto', links: [news.replace('/123', '')] })), true);
  assert.equal(isSiteRule(supportedScope(common, { url: park, mode: 'board', links: [news] })), false);
  assert.equal(isSiteRule(supportedScope(common, { url: park, mode: 'auto', links: [news.replace('www.clien.net', 'evil.example')] })), false);
});
test('사이트 공통 규칙도 게시판마다 요약 캐시를 분리하고 정제 링크만 전송', () => {
  const window = parseHTML('<html><body><h1>제목</h1><article>본문</article><div class="comments"><div class="row"><p class="text">댓글</p></div></div>' +
    `<nav><a href="${news}?token=secret#private">뉴스</a><a href="https://evil.example/test">외부</a><a href="/logout">나가기</a></nav></body></html>`);
  Object.assign(globalThis, { document: window.document, location: new URL(park), HTMLElement: window.HTMLElement,
    Node: window.Node, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) });
  const key = inspect(common)!.key;
  Object.assign(globalThis, { location: new URL(news) });
  assert.notEqual(inspect(common)!.key, key);
  assert.deepEqual(snapshot().links, [news]);
});
test('추출 실패만 1초 간격 두 번 재시도하고 이동 시 중단', async () => {
  let calls = 0, href = park, succeedAt = 3;
  Object.assign(globalThis, { chrome: { tabs: {
    get: async () => ({ url: href }), sendMessage: async () => ++calls >= succeedAt ? { count: 2, url: park } : null,
  } } });
  const delays: number[] = [];
  assert.ok(await previewRules(1, park, [common], async ms => { delays.push(ms); }));
  assert.equal(calls, 3); assert.deepEqual(delays, [1000, 1000]);
  calls = 0; succeedAt = 99;
  assert.equal(await previewRules(1, park, [common], async () => {}), null);
  assert.equal(calls, 3);
  calls = 0;
  assert.equal(await previewRules(1, park, [common], async () => { href = news; }), null);
  assert.equal(calls, 1);
});
