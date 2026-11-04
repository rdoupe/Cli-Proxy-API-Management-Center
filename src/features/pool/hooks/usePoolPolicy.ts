import { useEffect, useRef, useState } from 'react';
import { poolApi } from '@/services/api';
import { useAuthStore } from '@/stores';
import type { PoolPolicy } from '@/types/pool';
import { isPoolEndpointMissing, normalizePoolOverview } from '../logic';

export type PoolPolicyStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

/** Just the pool policy, for pages that already load everything else themselves. */
export function usePoolPolicy(): {
  status: PoolPolicyStatus;
  policy: PoolPolicy | null;
  setPolicy: (policy: PoolPolicy) => void;
} {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const [status, setStatus] = useState<PoolPolicyStatus>('idle');
  const [policy, setPolicy] = useState<PoolPolicy | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!connected) {
      requestRef.current += 1;
      setPolicy(null);
      setStatus('idle');
      return;
    }
    const requestId = ++requestRef.current;
    setStatus('loading');
    poolApi
      .getOverview()
      .then((payload) => {
        if (requestId !== requestRef.current) return;
        setPolicy(normalizePoolOverview(payload).policy);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (requestId !== requestRef.current) return;
        setPolicy(null);
        setStatus(isPoolEndpointMissing(error) ? 'unsupported' : 'error');
      });
  }, [connected]);

  return { status, policy, setPolicy };
}
