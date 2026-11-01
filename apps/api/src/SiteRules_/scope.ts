import { isSiteRule, matchRule, siteRuleSchema, specializeRule, type SiteRule } from '@summary/contracts';

// 링크는 구조 증거일 뿐이다. 추출 가능 여부는 실제 페이지에서 별도로 검증한다.
export function supportedScope(rule: SiteRule, input: { url: string; links?: string[]; mode?: string }): SiteRule {
  if (!isSiteRule(rule)) return rule;
  const boards = new Set<string>();
  const index = rule.pathTemplate.split('/').indexOf('{board}');
  for (const href of [input.url, ...(input.links || [])]) {
    const url = new URL(href);
    if (url.origin !== rule.origin) continue;
    if (matchRule(rule, href)) {
      boards.add(rule.boardQuery ? url.searchParams.get(rule.boardQuery)! : url.pathname.split('/')[index]);
    } else if (!rule.idQuery && rule.pathTemplate.endsWith('/{id}') && matchRule(rule, `${url.origin}${url.pathname.replace(/\/$/, '')}/__probe__`)) {
      boards.add(url.pathname.split('/')[index]);
    } else if (rule.boardQuery && rule.idQuery && url.pathname === rule.pathTemplate && url.searchParams.get(rule.boardQuery)) {
      boards.add(url.searchParams.get(rule.boardQuery)!);
    }
  }
  return input.mode === 'auto' && boards.size >= 2 ? rule : siteRuleSchema.parse(specializeRule(rule, input.url));
}
