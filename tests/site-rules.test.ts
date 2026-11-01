import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { matchRule, siteRuleSchema } from '../packages/contracts/src/index.ts';
import { inspect } from '../apps/extension/src/Sites_/Sites.ts';
import { diagnose } from '../apps/extension/src/Sites_/diagnose.ts';
import { snapshot } from '../apps/extension/src/Sites_/snapshot.ts';
import { readSummary, saveSummary } from '../apps/extension/src/SummaryPanel_/storage.ts';

const rule = siteRuleSchema.parse({ origin: 'https://www.clien.net', pathTemplate: '/service/board/park/{id}',
  idQuery: null, requiredQuery: [], title: '.post_subject > span', body: '.post_article',
  commentsRoot: '.post_comment', commentItem: '.comment_row', commentText: '.comment_view', replySelector: '.reply' });
const url = 'https://www.clien.net/service/board/park/19285969?od=T31&po=0';
function mount(html: string, href = url) {
  const window = parseHTML(`<html><body>${html}</body></html>`);
  Object.assign(globalThis, { document: window.document, location: new URL(href), HTMLElement: window.HTMLElement,
    Node: window.Node, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) });
}
const fixture = '<h3 class="post_subject"><span>제목</span><a>6</a></h3><div class="post_article">본문</div>' +
  '<div class="post_comment"><div class="comment_head">댓글</div><div class="comment">' +
  '<div class="comment_row"><span>닉네임</span><button>신고</button><div class="comment_view">첫 댓글</div></div>' +
  '<div class="comment_row reply"><div class="comment_view">답글</div></div></div></div>';

test('팝업 진단은 정상·제목 중복·텍스트 없음·잘못된 선택자를 구분', () => {
  mount(fixture);
  assert.equal(diagnose(rule).kind, 'ok');
  mount(fixture + '<h3 class="post_subject"><span></span></h3>');
  assert.equal(diagnose(rule).kind, 'error');
  assert.match(diagnose(rule).message, /제목이 여러 개/);
  mount(fixture.replace('첫 댓글', '<img>').replace('답글', '<img>'));
  assert.equal(diagnose(rule).kind, 'empty');
  assert.equal(diagnose({ ...rule, title: '[' }).kind, 'error');
});

test('게시판/도메인 구분, 정렬 쿼리 무시, 목록 제외', () => {
  assert.equal(matchRule(rule, url), '19285969');
  assert.equal(matchRule(rule, url.replace('park', 'news')), null);
  assert.equal(matchRule(rule, url.replace('www.clien.net', 'evil.example')), null);
  assert.equal(matchRule(rule, 'https://www.clien.net/service/board/park'), null);
  const queryRule = { ...rule, pathTemplate: '/index.php', idQuery: 'document_srl', requiredQuery: [{ key: 'mid', value: 'board' }] };
  assert.equal(matchRule(queryRule, 'https://www.clien.net/index.php?document_srl=123&mid=board'), '123');
  assert.equal(matchRule(queryRule, 'https://www.clien.net/index.php?document_srl=123&mid=other'), null);
});
test('클리앙 형태 DOM에서 본문만 추출하고 답글 구분', () => {
  mount(fixture);
  const result = inspect(rule)!;
  assert.equal(result.payload.title, '제목');
  assert.deepEqual(result.payload.comments.map(c => [c.text, c.isReply]), [['첫 댓글', false], ['답글', true]]);
  assert.equal(result.anchor.className, 'post_comment');
  mount(fixture, url.replace('19285969', '19285970'));
  assert.notEqual(inspect(rule)!.key, result.key);
});
test('애매하거나 잘못된 선택자/지연 로딩은 추출하지 않음', () => {
  mount(fixture + '<div class="post_article">중복</div>');
  assert.equal(inspect(rule), null);
  mount(fixture);
  assert.equal(inspect({ ...rule, commentText: '[' }), null);
  document.querySelector('.post_comment')!.setAttribute('aria-busy', 'true');
  assert.equal(inspect(rule), null);
});
test('정제 DOM에서 스크립트/입력/숨김/URL 비밀값 제거 및 크기 제한', () => {
  mount(fixture + '<script>secretScript</script><input value="secretInput"><div hidden>secretHidden</div>' + '<p>long</p>'.repeat(20000), url + '&token=secretToken');
  const result = snapshot();
  assert.ok(result.html.length <= 80000);
  assert.ok(!result.html.includes('secret'));
  assert.ok(!result.url.includes('secretToken'));
});
test('요약 저장은 게시글 키별로 분리하고 기존 결과 복원', async () => {
  const data: Record<string, unknown> = {};
  Object.assign(globalThis, { chrome: { storage: { local: {
    get: async (key: string) => ({ [key]: data[key] }), set: async (value: object) => Object.assign(data, value),
  } } } });
  const result = { summary: '요약 결과', count: 2 };
  assert.equal(await saveSummary('community-summary:v3:board:1', result, false), true);
  assert.equal((await readSummary('community-summary:v3:board:1'))?.result.summary, '요약 결과');
  assert.equal(await readSummary('community-summary:v3:board:2'), null);
});

test('표시 앵커는 댓글 추출 범위와 분리하고 기존 규칙은 기존 위치 유지', () => {
  mount('<main class="wide">' + fixture + '</main>');
  const legacy = { ...rule, commentsRoot: '.wide' };
  assert.equal(inspect(legacy)!.anchor.className, 'wide');
  const anchored = siteRuleSchema.parse({ ...legacy, summaryAnchor: '.comment_head' });
  assert.equal(inspect(anchored)!.anchor.className, 'comment_head');
  assert.equal(inspect(anchored)!.payload.comments.length, 2);
  assert.equal(inspect(anchored)!.key, inspect(legacy)!.key);
  for (const selector of ['.missing', '.comment_row', '.post_subject', '.wide', '.post_article']) {
    const invalid = { ...legacy, summaryAnchor: selector };
    assert.equal(inspect(invalid), null);
    assert.equal(diagnose(invalid).kind, 'error');
    assert.match(diagnose(invalid).message, /요약 표시 위치/);
  }
});

test('MLBPARK처럼 댓글 제목과 목록이 형제이면 제목 앞에 표시하고 목록에서만 추출', () => {
  mount('<h3 class="post_subject"><span>제목</span></h3><div class="post_article">본문</div>' +
    '<div id="reply_zone">댓글 1개</div><div class="reply_list"><div class="other_con"><span class="re_txt">댓글</span></div></div>');
  const selected = { ...rule, commentsRoot: '.reply_list', summaryAnchor: '#reply_zone', commentItem: '.other_con', commentText: '.re_txt' };
  assert.equal(inspect(selected)!.anchor.id, 'reply_zone');
  assert.deepEqual(inspect(selected)!.payload.comments.map(c => c.text), ['댓글']);
  assert.equal(diagnose(selected).kind, 'ok');
});
