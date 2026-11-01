import { limits, matchRule, ruleScope, specializeRule, type SiteRule, type SummaryRequest } from '@summary/contracts';
import { extract as dogdrip, findAnchor } from '../Dogdrip_/Dogdrip';

export type Page = { key: string; anchor: HTMLElement; payload: SummaryRequest; clipped: boolean; fingerprint: string };
export function inspect(rule?: SiteRule): Page | null {
  if (!rule) {
    if (!/^(www\.)?dogdrip\.net$/.test(location.hostname)) return null;
    const id = new URL(location.href).searchParams.get('document_srl') || location.pathname.match(/\/(\d+)\/?$/)?.[1]
      || document.querySelector('.xe_content[class*="document_"]')?.className.match(/document_(\d+)_/)?.[1];
    const anchor = findAnchor();
    if (!id || !/^\d+$/.test(id) || !anchor) return null;
    const value = dogdrip();
    return page(`community-summary:v2:dogdrip.net:${id}`, anchor, value.payload, value.clipped);
  }
  const id = matchRule(rule, location.href);
  if (!id) return null;
  try {
    const single = (selector: string) => {
      const nodes = document.querySelectorAll<HTMLElement>(selector);
      return nodes.length === 1 ? nodes[0] : null;
    };
    const titleNode = single(rule.title), bodyNode = single(rule.body), anchor = single(rule.commentsRoot);
    if (!titleNode || !bodyNode || !anchor || anchor.closest('[aria-busy="true"]') || anchor.querySelector('[aria-busy="true"]')) return null;
    const title = titleNode.textContent?.trim().slice(0, 500) || '';
    if (!title) return null;
    const comments: SummaryRequest['comments'] = [];
    let remaining = limits.total, clipped = false;
    for (const [i, item] of [...anchor.querySelectorAll(rule.commentItem)].entries()) {
      const node = rule.commentText === ':scope' ? item : item.querySelector(rule.commentText);
      const original = node?.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (!original) continue;
      if (comments.length >= limits.comments || !remaining) { clipped = true; continue; }
      const text = original.slice(0, Math.min(limits.comment, remaining));
      remaining -= text.length;
      clipped ||= text.length !== original.length;
      comments.push({ id: `comment_${i}`, text, isReply: !!rule.replySelector &&
        (item.matches(rule.replySelector) || !!item.querySelector(rule.replySelector)) });
    }
    const payload = { title, body: (bodyNode.textContent || '').trim().slice(0, limits.body), comments };
    return page(`community-summary:v3:${encodeURIComponent(ruleScope(specializeRule(rule, location.href)))}:${encodeURIComponent(id)}`, anchor, payload, clipped);
  } catch { return null; }
}
function page(key: string, anchor: HTMLElement, payload: SummaryRequest, clipped: boolean): Page {
  const article = `${payload.title}\n${payload.body}`;
  const comments = JSON.stringify(payload.comments);
  return { key, anchor, payload, clipped, fingerprint: article + comments };
}
