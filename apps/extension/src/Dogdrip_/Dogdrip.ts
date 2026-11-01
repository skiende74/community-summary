import { limits, type SummaryRequest } from '@summary/contracts';

export function extract(doc: Document = document) {
  const items = Array.from(doc.querySelectorAll<HTMLElement>('.comment-list .comment-item[id^="comment_"]'));
  const comments: SummaryRequest['comments'] = [];
  const seen = new Set<string>();
  let remaining = limits.total;
  let clipped = false;
  for (const item of items) {
    const original = item.querySelector('.xe_content')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!original || seen.has(item.id)) continue;
    seen.add(item.id);
    if (comments.length >= limits.comments || remaining === 0) { clipped = true; continue; }
    const text = original.slice(0, Math.min(limits.comment, remaining));
    clipped ||= text.length !== original.length;
    remaining -= text.length;
    comments.push({ id: item.id, text, isReply: item.classList.contains('depth') });
  }
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title;
  const body = doc.querySelector('.xe_content[class*="document_"]')?.textContent ?? '';
  return {
    payload: { title: title.trim().slice(0, 500), body: body.trim().slice(0, limits.body), comments },
    loaded: items.length, clipped,
  };
}

export function findAnchor() { return document.querySelector<HTMLElement>('#commentbox'); }
