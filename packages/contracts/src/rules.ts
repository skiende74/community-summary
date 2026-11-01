import { z } from 'zod';

const selector = z.string().trim().min(1).max(300);
export const siteRuleSchema = z.object({
  origin: z.string().url().refine(value => new URL(value).protocol === 'https:' && new URL(value).origin === value),
  pathTemplate: z.string().min(1).max(300).startsWith('/'),
  idQuery: z.string().max(80).nullable(),
  requiredQuery: z.array(z.object({ key: z.string().min(1).max(80), value: z.string().max(160) })).max(5),
  title: selector, body: selector, commentsRoot: selector, commentItem: selector, commentText: selector,
  replySelector: z.string().max(300).nullable(),
}).refine(rule => (rule.pathTemplate.match(/\{id\}/g)?.length === 1 && !rule.idQuery)
  || (!rule.pathTemplate.includes('{id}') && !!rule.idQuery), '게시글 ID 규칙이 필요합니다.');
export const ruleRequestSchema = z.object({ url: z.string().url().max(2000), html: z.string().min(100).max(80000) });
export const ruleResponseSchema = z.object({ supported: z.boolean(), reason: z.string().max(500), rule: siteRuleSchema.nullable(), candidateId: z.string().uuid().optional() });
export const ruleLookupSchema = z.object({ url: z.string().url().max(2000).refine(url => new URL(url).protocol === 'https:') });
export const ruleLookupResponseSchema = z.object({ rule: siteRuleSchema.nullable() });
export const ruleConfirmSchema = ruleLookupSchema.extend({ candidateId: z.string().uuid() });
export type SiteRule = z.infer<typeof siteRuleSchema>;

export function matchRule(rule: SiteRule, href: string) {
  const url = new URL(href);
  if (url.origin !== rule.origin || rule.requiredQuery.some(q => url.searchParams.get(q.key) !== q.value)) return null;
  const parts = rule.pathTemplate.split('{id}');
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${parts.map(escape).join('([^/]+)')}/?$`).exec(url.pathname);
  const id = rule.idQuery ? url.searchParams.get(rule.idQuery) : match?.[1];
  return match && id && id.length <= 200 ? id : null;
}
export const ruleScope = (rule: SiteRule) => JSON.stringify([rule.origin, rule.pathTemplate, rule.idQuery, rule.requiredQuery]);
