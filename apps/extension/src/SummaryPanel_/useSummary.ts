import { useCallback, useEffect, useRef, useState } from 'react';
import { responseSchema } from '@summary/contracts';
import { extract } from '../Dogdrip_/Dogdrip';
import { readSummary, saveSummary } from './storage';

export function useSummary() {
  const [state, setState] = useState(() => {
    const saved = readSummary();
    return saved
      ? { status: 'done', text: saved.result.summary, count: saved.result.count, clipped: saved.clipped, error: '' }
      : { status: 'idle', text: '', count: 0, clipped: false, error: '' };
  });
  const [storageError, setStorageError] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(async (refresh = false) => {
    if (busy.current) return;
    const { payload, clipped } = extract();
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
      const saved = saveSummary(result, clipped);
      if (alive.current) setStorageError(!saved);
      if (alive.current) setState({ status: 'done', text: result.summary, count: result.count, clipped, error: '' });
    } catch (error) {
      if (alive.current) setState({ status: 'error', text: '', count, clipped,
        error: error instanceof Error ? error.message : '요약에 실패했습니다.' });
    } finally { busy.current = false; }
  }, []);
  return { ...state, storageError, run };
}
