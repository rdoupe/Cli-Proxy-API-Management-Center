import type { PoolPolicy } from '@/types/pool';

export interface PolicyDescription {
  nameKey: string;
  stepKeys: string[];
}

/**
 * The policy in words, as translation keys. Both switches change the heading: with paid
 * fallback off, the heading itself says API keys are excluded, whichever strategy is on.
 */
export function describePolicy(policy: PoolPolicy | null): PolicyDescription {
  if (!policy) {
    return {
      nameKey: 'pool.policy_name_existing',
      stepKeys: ['pool.policy_step_priority', 'pool.policy_step_limits'],
    };
  }
  const subscriptionsFirst = policy.strategy === 'subscriptions_first';
  const keysExcluded = !policy.allowPaidFallback;
  const nameKey = subscriptionsFirst
    ? keysExcluded
      ? 'pool.policy_name_subscriptions_only'
      : 'pool.policy_name_subscriptions_first'
    : keysExcluded
      ? 'pool.policy_name_existing_no_keys'
      : 'pool.policy_name_existing';
  const stepKeys = subscriptionsFirst
    ? [
        'pool.policy_step_subscriptions',
        keysExcluded ? 'pool.policy_step_keys_excluded' : 'pool.policy_step_paid_fallback_on',
        'pool.policy_step_limits',
      ]
    : [
        'pool.policy_step_priority',
        ...(keysExcluded ? ['pool.policy_step_keys_excluded'] : []),
        'pool.policy_step_limits',
      ];
  return { nameKey, stepKeys };
}
