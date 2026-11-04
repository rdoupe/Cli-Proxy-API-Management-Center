import { useCallback, useEffect, useRef, useState } from 'react';
import { poolApi } from '@/services/api';
import { useAuthStore } from '@/stores';
import type { PoolStats, PoolStatsRange } from '@/types/pool';
import { getErrorMessage } from '@/utils/helpers';
import { isPoolEndpointMissing, normalizePoolStats } from '../logic';

export type PoolStatsStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

export interface PoolStatsState {
  status: PoolStatsStatus;
  stats: PoolStats | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePoolStats(range: PoolStatsRange): PoolStatsState {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const [status, setStatus] = useState<PoolStatsStatus>('idle');
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!connected) return;
    const requestId = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const payload = await poolApi.getStats(range);
      if (requestId !== requestRef.current) return;
      setStats(normalizePoolStats(payload, range));
      setStatus('ready');
    } catch (requestError) {
      if (requestId !== requestRef.current) return;
      if (isPoolEndpointMissing(requestError)) {
        setStats(null);
        setStatus('unsupported');
        return;
      }
      setError(getErrorMessage(requestError, 'Request failed'));
      setStatus('error');
    }
  }, [connected, range]);

  useEffect(() => {
    if (!connected) {
      requestRef.current += 1;
      setStats(null);
      setStatus('idle');
      return;
    }
    void load();
  }, [connected, load]);

  return { status, stats, error, refresh: load };
}
