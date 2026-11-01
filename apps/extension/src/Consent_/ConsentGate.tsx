import { useEffect, useState, type ReactNode } from 'react';

import { consentKey, hasConsent } from './Consent';
export function ConsentGate({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState<boolean>();
  const [error, setError] = useState('');
  useEffect(() => {
    void hasConsent().then(setAccepted).catch(() => setError('설정을 읽지 못했어요. 다시 열어 주세요.'));
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && consentKey in changes) setAccepted(changes[consentKey].newValue === true);
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, []);
  if (accepted) return children;
  return <main>
    <h1>댓글 요약 시작하기</h1>
    <p>아래 데이터 전송에 동의하면 자동 요약을 사용할 수 있어요.</p>
    <ul>
      <li>등록된 사이트 목록을 받아 현재 사이트와 브라우저 안에서 비교해요. 목록에 없고 저장된 규칙도 없는 사이트의 URL은 자동 전송하지 않아요.</li>
      <li>등록된 사이트에서는 규칙 조회를 위해 페이지 URL을 서버로 보내요.</li>
      <li>요약 시 게시글 제목·본문 일부·텍스트 댓글을 서버와 OpenAI로 보내요. 펼친 요약 영역이 화면 가까이 오면 자동 요청할 수 있어요.</li>
      <li>직접 초기 설정을 실행하면 페이지 URL·텍스트·정제된 HTML 구조와 같은 사이트 링크 일부를 서버와 OpenAI로 보내요. 이미지 파일과 입력란은 제외하지만 텍스트에 포함된 개인정보가 전송될 수 있어요.</li>
    </ul>
    <p><a href="https://github.com/skiende74/community-summary/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">개인정보처리방침</a> · 설정에서 언제든 동의를 철회할 수 있어요.</p>
    <button disabled={accepted === undefined} onClick={() => void chrome.storage.local.set({ [consentKey]: true }).then(() => setAccepted(true)).catch(() => setError('저장하지 못했어요. 다시 시도해 주세요.'))}>동의하고 시작</button>
    <p role="status">{error}</p>
  </main>;
}
