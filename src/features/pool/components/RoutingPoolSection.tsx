import { useTranslation } from 'react-i18next';
import type { PoolPolicy } from '@/types/pool';
import type { RoutingSettings } from '@/types/routing';
import type { PoolPolicyStatus } from '../hooks/usePoolPolicy';
import { ExplainRoute } from './ExplainRoute';
import { PolicyCard } from './PolicyCard';
import { PolicyEditor } from './PolicyEditor';
import styles from '../pool.module.scss';

interface RoutingPoolSectionProps {
  settings: RoutingSettings | null;
  status: PoolPolicyStatus;
  policy: PoolPolicy | null;
  onPolicySaved: (policy: PoolPolicy) => void;
}

/**
 * Sits above the tier board: the policy in words, and a way to ask which account would serve a
 * given model. Both come from the backend; neither is inferred from the board.
 */
export function RoutingPoolSection({
  settings,
  status,
  policy,
  onPolicySaved,
}: RoutingPoolSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.page} ${styles.twoUp}`} style={{ gap: 20 }}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{t('pool.policy_title')}</h2>
          {status === 'unsupported' ? (
            <p className={styles.sectionNote}>{t('pool.backend_old_policy')}</p>
          ) : null}
        </div>
        <div className={styles.panel}>
          <PolicyCard
            policy={policy}
            settings={settings}
            showLink={false}
            missing={
              status === 'error' ? 'error' : status === 'unsupported' ? 'unsupported' : 'loading'
            }
          />
          {policy ? (
            <div style={{ marginTop: 16 }}>
              <PolicyEditor policy={policy} onSaved={onPolicySaved} />
            </div>
          ) : null}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{t('pool.explain_title')}</h2>
        </div>
        <div className={styles.panel}>
          <ExplainRoute />
        </div>
      </section>
    </div>
  );
}
