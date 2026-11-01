import { z } from 'zod';

const selector = z.string().trim().min(1).max(300);
export const siteRuleSchema = z.object({
  origin: z.string().url().refine(value => new URL(value).protocol === 'https:' && new URL(value).origin === value),
  pathTemplate: z.string().min(1).max(300).startsWith('/'),
  idQuery: z.string().max(80).nullable(),
  boardQuery: z.string().min(1).max(80).nullable().optional(),
  requiredQuery: z.array(z.object({ key: z.string().min(1).max(80), value: z.string().max(160) })).max(5),
  title: selector, body: selector, commentsRoot: selector, commentItem: selector, commentText: selector,
  replySelector: z.string().max(300).nullable(),
}).refine(rule => ((rule.pathTemplate.match(/\{id\}/g)?.length === 1 && !rule.idQuery)
  || (!rule.pathTemplate.includes('{id}') && !!rule.idQuery))
  && !rule.pathTemplate.replace(/\{id\}|\{board\}/g, '').match(/[{}?#]/)
  && (rule.pathTemplate.match(/\{board\}/g)?.length || 0) <= 1
  && (!rule.pathTemplate.includes('{board}') || rule.pathTemplate.split('/').includes('{board}'))
  && !(rule.boardQuery && (rule.pathTemplate.includes('{board}') || rule.boardQuery === rule.idQuery
    || rule.requiredQuery.some(q => q.key === rule.boardQuery))), '게시글·게시판 URL 규칙이 올바르지 않습니다.');
export const ruleRequestSchema = z.object({ url: z.string().url().max(2000), html: z.string().min(100).max(80000),
  links: z.array(z.string().url().max(500)).max(40).optional(), mode: z.enum(['auto', 'board']).optional() });
export const ruleResponseSchema = z.object({ supported: z.boolean(), reason: z.string().max(500), rule: siteRuleSchema.nullable(), candidateId: z.string().uuid().optional() });
export const ruleLookupSchema = z.object({ url: z.string().url().max(2000).refine(url => new URL(url).protocol === 'https:'), includeSiteRules: z.boolean().optional() });
export const ruleLookupResponseSchema = z.object({ rule: siteRuleSchema.nullable(), rules: z.array(siteRuleSchema).max(100).optional() });
export const ruleConfirmSchema = ruleLookupSchema.extend({ candidateId: z.string().uuid() });
export type SiteRule = z.infer<typeof siteRuleSchema>;

export function matchRule(rule: SiteRule, href: string) {
  const url = new URL(href);
  if (url.origin !== rule.origin || rule.requiredQuery.some(q => url.searchParams.get(q.key) !== q.value)) return null;
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = rule.pathTemplate.split(/(\{id\}|\{board\})/).map(part =>
    part === '{id}' ? '(?<id>[^/]+)' : part === '{board}' ? '(?<board>[^/]+)' : escape(part)).join('');
  const match = new RegExp(`^${pattern}/?$`).exec(url.pathname);
  if (rule.boardQuery && !url.searchParams.get(rule.boardQuery)) return null;
  const id = rule.idQuery ? url.searchParams.get(rule.idQuery) : match?.groups?.id;
  return match && id && id.length <= 200 ? id : null;
}
export const isSiteRule = (rule: SiteRule) => rule.pathTemplate.includes('{board}') || !!rule.boardQuery;
export const ruleScope = (rule: SiteRule) => JSON.stringify([rule.origin, rule.pathTemplate, rule.idQuery, rule.requiredQuery,
  ...(rule.boardQuery ? [rule.boardQuery] : [])]);
export const matchingRules = (rules: SiteRule[], url: string) => rules.filter(rule => matchRule(rule, url))
  .sort((a, b) => Number(isSiteRule(a)) - Number(isSiteRule(b))
    || b.requiredQuery.length - a.requiredQuery.length || b.pathTemplate.length - a.pathTemplate.length);
export function specializeRule(rule: SiteRule, href: string): SiteRule {
  const url = new URL(href);
  const index = rule.pathTemplate.split('/').indexOf('{board}');
  const { boardQuery, ...board } = rule;
  return { ...board, pathTemplate: index < 0 ? rule.pathTemplate
    : rule.pathTemplate.replace('{board}', url.pathname.split('/')[index]),
    requiredQuery: boardQuery ? [...rule.requiredQuery, { key: boardQuery, value: url.searchParams.get(boardQuery) || '' }] : rule.requiredQuery };
}
