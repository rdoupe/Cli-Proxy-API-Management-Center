import type { PoolAccount } from '@/types/pool';
import type { PoolAccountAction } from './hooks/usePoolOverview';

/** Actions an account supports, given what the backend can do with it. */
export function availableActions(account: PoolAccount): PoolAccountAction[] {
  const actions: PoolAccountAction[] = [];
  if (account.fileName) {
    if (account.state === 'paused') actions.push('resume');
    else actions.push('pause');
    if (account.kind === 'subscription' && account.state !== 'paused') actions.push('check');
  }
  const blocked =
    account.state === 'rate_limited' ||
    account.state === 'out_of_credits' ||
    account.state === 'unavailable';
  if (blocked && (account.managedIn === 'pool' || account.authIndex)) actions.push('clear_limit');
  return actions;
}
