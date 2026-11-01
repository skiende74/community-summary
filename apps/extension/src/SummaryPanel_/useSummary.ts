import { useCallback, useEffect, useRef, useState } from 'react';
import { responseSchema } from '@summary/contracts';
import type { Page } from '../Sites_/Sites';
import { readSummary, saveSummary } from './storage';

export function useSummary(initial: Page, getPage: () => Page | null) {
  const [state, setState] = useState({ status: 'restoring', text: '', count: 0, clipped: false, error: '' });
  const [storageError, setStorageError] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const restoring = useRef(true);
  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    void readSummary(initial.key).then(saved => {
      if (cancelled) return;
      restoring.current = false;
      setState(saved
        ? { status: 'done', text: saved.result.summary, count: saved.result.count, clipped: saved.clipped, error: '' }
        : { status: 'idle', text: '', count: 0, clipped: false, error: '' });
    });
    return () => { cancelled = true; alive.current = false; };
  }, []);
  const run = useCallback(async (refresh = false) => {
    if (busy.current || restoring.current) return;
    const current = getPage();
    if (!current || current.key !== initial.key) return;
    const { key, payload, clipped } = current;
    const count = payload.comments.length;
    if (!count) {
      setState({ status: 'empty', text: '', count, clipped, error: '' });
      return;
    }
    busy.current = true;
    setState({ status: 'loading', text: '', count, clipped, error: '' });
    try {
      const data = await chrome.runtime.sendMessage({ type: 'summarize', payload, refresh });
      if (data?.error) throw new Error(data.error);
      const result = responseSchema.parse(data?.result);
      const saved = await saveSummary(key, result, clipped);
      if (alive.current && getPage()?.key === key) {
        setStorageError(!saved);
        setState({ status: 'done', text: result.summary, count: result.count, clipped, error: '' });
      }
    } catch (error) {
      if (alive.current && getPage()?.key === key) setState({ status: 'error', text: '', count, clipped,
        error: error instanceof Error ? error.message : '요약에 실패했습니다.' });
    } finally { busy.current = false; }
  }, [initial.key, getPage]);
  return { ...state, storageError, run };
}
