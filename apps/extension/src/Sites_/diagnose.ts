import type { SiteRule } from '@summary/contracts';
import { inspect } from './Sites';

export type ExtractionStatus = { kind: 'ok' | 'empty' | 'error' | 'disabled' | 'checking' | 'unconfigured'; message: string };
export function diagnose(rule?: SiteRule): ExtractionStatus {
  try {
    if (rule) {
      for (const [name, selector] of [['제목', rule.title], ['본문', rule.body], ['댓글 영역', rule.commentsRoot]]) {
        const count = document.querySelectorAll(selector).length;
        if (count !== 1) return { kind: 'error', message: count > 1
          ? `${name}이 여러 개 선택되어 댓글을 추출하지 못했어요. 규칙을 다시 만들어 주세요.`
          : `${name}을 찾지 못했어요. 로딩 후 다시 확인하거나 규칙을 다시 만들어 주세요.` };
      }
    }
    const page = inspect(rule);
    if (!page) return { kind: 'error', message: '현재 페이지에서 댓글을 추출하지 못했어요. 로딩 상태와 추출 규칙을 확인해 주세요.' };
    return page.payload.comments.length
      ? { kind: 'ok', message: `텍스트 댓글 ${page.payload.comments.length}개를 정상적으로 읽고 있어요.` }
      : { kind: 'empty', message: '댓글 영역은 찾았지만 읽을 텍스트가 없어요. 이미지 댓글만 있거나 아직 댓글이 로드되지 않았을 수 있어요.' };
  } catch { return { kind: 'error', message: '추출 규칙의 선택자가 올바르지 않아요. 규칙을 다시 만들어 주세요.' }; }
}
