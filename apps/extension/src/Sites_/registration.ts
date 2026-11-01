// 0.2.2부터 manifest의 정적 스크립트가 모든 HTTPS 사이트를 담당한다.
// 이전 버전에서 등록한 동적 스크립트는 업데이트 시 제거한다.
let pending = Promise.resolve();
export function syncScripts() {
  pending = pending.catch(() => {}).then(async () => {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['approved-sites'] });
    if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: ['approved-sites'] });
  });
  return pending;
}
