import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../settings';
import { useSummary } from './useSummary';
import { Icon } from './Icon';
import type { Page } from '../Sites_/Sites';

export function SummaryPanel({ settings, page, getPage }: { settings: Settings; page: Page; getPage: () => Page | null }) {
  const [open, setOpen] = useState(settings.expanded);
  const [near, setNear] = useState(false);
  const [above, setAbove] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const summary = useSummary(page, getPage);
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setNear(entry.isIntersecting);
      setAbove(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    }, { rootMargin: '200px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open && near && summary.status === 'idle') void summary.run();
  }, [open, near, summary.status, summary.run]);
  const jump = () => {
    setOpen(true);
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return <>
    <section ref={panel} className="panel" aria-label="댓글 반응 요약">
      <header>
      <button className="heading" aria-expanded={open} aria-controls="summary-body" onClick={() => setOpen(value => !value)}>
        댓글 반응 요약
      </button>
      {open && <button className="icon-button" disabled={summary.status === 'loading' || summary.status === 'restoring'}
        title={summary.status === 'error' ? '다시 시도' : '요약 갱신'}
        aria-label={summary.status === 'error' ? '다시 시도' : '요약 갱신'} onClick={() => void summary.run(true)}>
        <Icon name="refresh" spinning={summary.status === 'loading'} />
      </button>}
      <button className="icon-button" title={open ? '접기' : '펼치기'} aria-label={open ? '요약 접기' : '요약 펼치기'}
        aria-expanded={open} aria-controls="summary-body" onClick={() => setOpen(value => !value)}>
        <Icon name={open ? 'up' : 'down'} />
      </button>
      </header>
      {open && <div id="summary-body" className="body">
        <div role="status" aria-live="polite" aria-busy={summary.status === 'loading'}>
          {summary.status === 'idle' && '댓글 반응을 요약할 준비가 됐어요.'}
          {summary.status === 'restoring' && <span className="muted">저장된 요약 확인 중…</span>}
          {summary.status === 'loading' && <span className="muted">요약 중…</span>}
          {summary.status === 'empty' && '현재 로드된 텍스트 댓글이 없어요.'}
          {summary.status === 'done' && <p className="summary">{summary.text}</p>}
          {summary.status === 'error' && <p className="error">{summary.error}</p>}
        </div>
        {summary.clipped && <small>길이 제한으로 일부만 반영</small>}
        {summary.storageError && <small>브라우저에 저장하지 못해 새로고침 시 다시 요청될 수 있어요.</small>}
      </div>}
    </section>
    {above && <button className="floating" onClick={jump}>댓글 요약 <Icon name="down" /></button>}
  </>;
}
