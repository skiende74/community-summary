import { useEffect, useState } from 'react';
import type { ExtractionStatus as Status } from '../Sites_/diagnose';

export function ExtractionStatus({ tabId, url }: { tabId: number; url: string }) {
  const [state, setState] = useState<Status>({ kind: 'checking', message: '현재 페이지의 댓글 추출 상태를 확인하는 중…' });
  useEffect(() => {
    let alive = true, pending = false;
    const check = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await chrome.tabs.sendMessage(tabId, { type: 'extraction-status' });
        if (alive) setState(result?.url === url && result.status ? result.status
          : { kind: 'error', message: '페이지가 바뀌었어요. 팝업을 다시 열어 주세요.' });
      } catch {
        if (alive) setState({ kind: 'error', message: '페이지와 연결하지 못했어요. 사이트 권한을 확인하고 게시글을 새로고침해 주세요.' });
      } finally { pending = false; }
    };
    void check();
    // 페이지 안에서만 검사하며 서버나 LLM 요청은 보내지 않는다.
    const timer = window.setInterval(() => void check(), 1500);
    return () => { alive = false; clearInterval(timer); };
  }, [tabId, url]);
  return <div className={`extraction-status ${state.kind}`} role="status" aria-live="polite">
    <strong>{state.kind === 'ok' ? '댓글 추출 정상' : state.kind === 'error' ? '댓글 추출 확인 필요'
      : state.kind === 'empty' ? '텍스트 댓글 없음' : state.kind === 'disabled' ? '요약 기능 꺼짐' : '상태 확인 중'}</strong>
    <p>{state.message}</p>
  </div>;
}
