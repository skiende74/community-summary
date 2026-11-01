import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestSchema, shortenBody } from '../packages/contracts/src/index.ts';

test('600자 이하는 유지하고 초과하면 앞뒤 300자와 중략 안내만 유지', () => {
  assert.equal(shortenBody('가'.repeat(600)), '가'.repeat(600));
  const original = '앞'.repeat(300) + '중'.repeat(500) + '뒤'.repeat(300);
  const expected = '앞'.repeat(300) + '\n(중략하였음)\n' + '뒤'.repeat(300);
  assert.equal(shortenBody(original), expected);
  assert.equal(shortenBody(expected), expected);
  assert.equal(shortenBody('😀'.repeat(601)), '😀'.repeat(300) + '\n(중략하였음)\n' + '😀'.repeat(300));
  assert.equal(shortenBody('   '), '');
});

test('구형 확장의 본문도 서버 요청 파싱에서 축약하며 이미 축약한 요청은 보존', () => {
  const input = { title: '제목', body: '가'.repeat(6000), comments: [{ id: 'comment_1', text: '댓글', isReply: false }] };
  const once = requestSchema.parse(input);
  assert.equal(once.body, shortenBody(input.body));
  assert.deepEqual(requestSchema.parse(once), once);
});
