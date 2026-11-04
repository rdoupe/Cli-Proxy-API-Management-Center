import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PoolPolicy } from '@/types/pool';
import type { RoutingSettings } from '@/types/routing';
import styles from '../pool.module.scss';

interface PolicyCardProps {
  policy: PoolPolicy | null;
  /** Config-side routing settings, shown when the backend has no pool policy. */
  settings?: RoutingSettings | null;
  /** Hide the link when the card already lives on the routing page. */
  showLink?: boolean;
}

/**
 * The routing policy in plain words. It states only what a contract reports: the pool's
 * policy when the backend has one, otherwise the strict-priority behaviour of the config.
 */
export function PolicyCard({ policy, settings, showLink = true }: PolicyCardProps) {
  const { t } = useTranslation();

  const steps = policy
    ? policy.strategy === 'subscriptions_first'
      ? [
          t('pool.policy_step_subscriptions'),
          policy.allowPaidFallback
            ? t('pool.policy_step_paid_fallback_on')
            : t('pool.policy_step_paid_fallback_off'),
          t('pool.policy_step_limits'),
        ]
      : [t('pool.policy_step_priority'), t('pool.policy_step_limits')]
    : [t('pool.policy_step_priority'), t('pool.policy_step_limits')];

  const strategyLine = settings
    ? t(`pool.policy_strategy_${settings.strategy.replace(/-/g, '_')}`)
    : null;

  return (
    <div className={styles.policy}>
      <p>
        <b>
          {policy
            ? policy.strategy === 'subscriptions_first'
              ? t('pool.policy_name_subscriptions_first')
              : t('pool.policy_name_existing')
            : t('pool.policy_name_existing')}
        </b>
      </p>
      <ol className={styles.policySteps}>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {strategyLine ? <p>{strategyLine}</p> : null}
      {!policy ? <p>{t('pool.policy_source_config')}</p> : null}
      {showLink ? (
        <Link to="/routing" className={styles.sectionLink}>
          {t('pool.policy_link')}
        </Link>
      ) : null}
    </div>
  );
}
