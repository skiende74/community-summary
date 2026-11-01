const privateQuery = /token|auth|session|password|secret|key|email|code/i;
export function publicUrl(href: string) {
  const url = new URL(href);
  for (const key of [...url.searchParams.keys()]) if (privateQuery.test(key)) url.searchParams.delete(key);
  url.hash = ''; url.username = ''; url.password = '';
  return url.href;
}
export function pageLinks() {
  const links = new Set<string>();
  for (const anchor of [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].slice(0, 1000)) {
    if (anchor.closest('form,[contenteditable],community-summary')) continue;
    try {
      const url = new URL(anchor.getAttribute('href')!, location.href);
      if (url.origin !== location.origin || url.protocol !== 'https:' || /login|logout|signout|password|account|profile|message/i.test(url.pathname)) continue;
      const href = publicUrl(url.href);
      if (href.length <= 500) links.add(href);
      if (links.size >= 40) break;
    } catch { /* 비 URL 링크 제외 */ }
  }
  return [...links];
}
