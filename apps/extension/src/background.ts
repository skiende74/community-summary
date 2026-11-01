import { requestSchema, responseSchema } from '@summary/contracts';
import { apiUrl } from './config';

chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage(); });
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !sender.url ||
      !/^https:\/\/(www\.)?dogdrip\.net\//.test(sender.url) || message?.type !== 'summarize') return;
  const parsed = requestSchema.safeParse(message.payload);
  if (!parsed.success) { sendResponse({ error: '요약할 댓글이 올바르지 않습니다.' }); return; }
  void (async () => {
    try {
      const response = await fetch(`${apiUrl}/summarize`, {
        method: 'POST', headers: {
          'Content-Type': 'application/json', 'X-Community-Summary': '1',
          'X-Summary-Refresh': message.refresh === true ? '1' : '0',
        },
        body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(26_000),
      });
      const data = await response.json();
      sendResponse(response.ok ? { result: responseSchema.parse(data) } : {
        error: typeof data.error === 'string' ? data.error : '서버 요청에 실패했습니다.',
      });
    } catch {
      sendResponse({ error: '요약 서버에 연결하지 못했거나 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.' });
    }
  })();
  return true;
});
