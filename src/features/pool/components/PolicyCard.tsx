import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PoolPolicy } from '@/types/pool';
import type { RoutingSettings } from '@/types/routing';
import { describePolicy } from '../policyDescription';
import styles from '../pool.module.scss';

/** Why the card has no pool policy to describe. */
export type PolicyMissingReason = 'unsupported' | 'error' | 'loading';

interface PolicyCardProps {
  policy: PoolPolicy | null;
  /** Config-side routing settings, shown when the backend has no pool policy. */
  settings?: RoutingSettings | null;
  /** Hide the link when the card already lives on the routing page. */
  showLink?: boolean;
  /** When `policy` is null: whether that is an older backend, a failed read, or still loading. */
  missing?: PolicyMissingReason;
}

/**
 * The routing policy in plain words. It states only what a contract reports: the pool's
 * policy when the backend has one, otherwise the strict-priority behaviour of the config.
 */
export function PolicyCard({ policy, settings, showLink = true, missing }: PolicyCardProps) {
  const { t } = useTranslation();
  const { nameKey, stepKeys } = describePolicy(policy);

  const strategyLine = settings
    ? t(`pool.policy_strategy_${settings.strategy.replace(/-/g, '_')}`)
    : null;

  const missingLine = policy
    ? null
    : missing === 'error'
      ? t('pool.policy_load_failed')
      : missing === 'loading'
        ? t('pool.overview_loading')
        : t('pool.policy_source_config');

  return (
    <div className={styles.policy}>
      <p>
        <b>{t(nameKey)}</b>
      </p>
      <ol className={styles.policySteps}>
        {stepKeys.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
      {strategyLine ? <p>{strategyLine}</p> : null}
      {missingLine ? <p data-policy-missing={missing ?? 'unsupported'}>{missingLine}</p> : null}
      {showLink ? (
        <Link to="/routing" className={styles.sectionLink}>
          {t('pool.policy_link')}
        </Link>
      ) : null}
    </div>
  );
}
