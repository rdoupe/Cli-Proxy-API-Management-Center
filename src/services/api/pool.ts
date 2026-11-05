/**
 * Account pool endpoints (v8 `/pool/*`).
 *
 * Older backends answer 404; callers use `isPoolEndpointMissing` to show an explicit
 * "needs a newer backend" state instead of empty numbers.
 */

import { apiClient } from './client';
import type { PoolPolicy, PoolStatsRange } from '@/types/pool';

const POOL_TIMEOUT_MS = 15 * 1000;

export const poolApi = {
  getOverview: () => apiClient.get<unknown>('/pool/overview', { timeout: POOL_TIMEOUT_MS }),
  getStats: (range: PoolStatsRange) =>
    apiClient.get<unknown>('/pool/stats', { params: { range }, timeout: POOL_TIMEOUT_MS }),
  explain: (model: string) =>
    apiClient.get<unknown>('/pool/explain', { params: { model }, timeout: POOL_TIMEOUT_MS }),
  getPolicy: () => apiClient.get<unknown>('/pool/policy', { timeout: POOL_TIMEOUT_MS }),
  setPolicy: (policy: Partial<PoolPolicy>) =>
    apiClient.put<unknown>('/pool/policy', policy, { timeout: POOL_TIMEOUT_MS }),
  /** Clears an out-of-credits block and cooldowns; `id` is the pool account id. */
  resetAccount: (id: string) =>
    apiClient.post<unknown>(`/pool/accounts/${encodeURIComponent(id)}/reset`, undefined, {
      timeout: POOL_TIMEOUT_MS,
    }),
};
