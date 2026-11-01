const ignored = 'script,style,noscript,iframe,svg,form,input,textarea,select,[contenteditable],nav,community-summary,[hidden],[aria-hidden="true"]';
export function snapshot() {
  let remaining = 80000;
  const take = (value: string) => { const text = value.slice(0, remaining); remaining -= text.length; return text; };
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const walk = (node: Node, depth: number): string => {
    if (depth > 25 || !remaining) return '';
    if (node.nodeType === Node.TEXT_NODE) return take(escape((node.textContent || '').replace(/\s+/g, ' ').slice(0, 160)));
    if (!(node instanceof HTMLElement) || node.matches(ignored)) return '';
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
    const tag = node.tagName.toLowerCase();
    const attrs = ['id', 'class', 'role', 'data-role'].map(key => {
      const value = node.getAttribute(key)?.slice(0, 200);
      return value ? ` ${key}="${escape(value)}"` : '';
    }).join('');
    let html = take(`<${tag}${attrs}>`);
    for (const child of node.childNodes) { if (!remaining) break; html += walk(child, depth + 1); }
    return html + take(`</${tag}>`);
  };
  const html = walk(document.body, 0);
  const url = new URL(location.href);
  for (const key of [...url.searchParams.keys()]) if (/token|auth|session|password|key/i.test(key)) url.searchParams.delete(key);
  url.hash = '';
  return { url: url.href, html };
}
