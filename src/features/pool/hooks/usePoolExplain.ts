import { useCallback, useRef, useState } from 'react';
import { poolApi } from '@/services/api';
import type { PoolExplain } from '@/types/pool';
import { getErrorMessage } from '@/utils/helpers';
import { isPoolEndpointMissing, normalizePoolExplain } from '../logic';

export type PoolExplainStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

export function usePoolExplain() {
  const [status, setStatus] = useState<PoolExplainStatus>('idle');
  const [result, setResult] = useState<PoolExplain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const explain = useCallback(async (model: string) => {
    const trimmed = model.trim();
    if (!trimmed) return;
    const requestId = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const payload = await poolApi.explain(trimmed);
      if (requestId !== requestRef.current) return;
      setResult(normalizePoolExplain(payload));
      setStatus('ready');
    } catch (requestError) {
      if (requestId !== requestRef.current) return;
      if (isPoolEndpointMissing(requestError)) {
        setStatus('unsupported');
        return;
      }
      setError(getErrorMessage(requestError, 'Request failed'));
      setStatus('error');
    }
  }, []);

  return { status, result, error, explain };
}
