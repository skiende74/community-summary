import type { SiteRule } from '@summary/contracts';

export function placementError(rule: SiteRule): string | null {
  if (!rule.summaryAnchor) return null; // 기존 규칙의 표시 방식은 유지한다.
  const nodes = document.querySelectorAll(rule.summaryAnchor);
  if (nodes.length !== 1) return '요약 표시 위치를 하나로 찾지 못했어요. 규칙을 다시 만들어 주세요.';
  const anchor = nodes[0], body = document.querySelector(rule.body);
  if (!body || anchor.contains(body) || body.contains(anchor)
    || !follows(body, anchor))
    return '요약 표시 위치가 본문 뒤가 아니에요. 댓글 제목이나 목록 앞을 선택하도록 규칙을 다시 만들어 주세요.';
  return null;
}

function follows(body: Element, anchor: Element): boolean {
  for (let node: Element | null = body; node; node = node.parentElement)
    for (let next = node.nextElementSibling; next; next = next.nextElementSibling)
      if (next.contains(anchor)) return true;
  return false;
}
