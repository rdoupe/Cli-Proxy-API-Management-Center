import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { poolApi } from '@/services/api';
import { useNotificationStore } from '@/stores';
import type { PoolPolicy, PoolStrategy } from '@/types/pool';
import { getErrorMessage } from '@/utils/helpers';
import styles from '../pool.module.scss';

interface PolicyEditorProps {
  policy: PoolPolicy;
  disabled?: boolean;
  onSaved: (policy: PoolPolicy) => void;
}

const STRATEGIES: PoolStrategy[] = ['existing', 'subscriptions_first'];

/** Two plain switches that write `PUT /pool/policy` at once; the backend applies them immediately. */
export function PolicyEditor({ policy, disabled = false, onSaved }: PolicyEditorProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<PoolPolicy>) => {
    setSaving(true);
    try {
      await poolApi.setPolicy(patch);
      onSaved({ ...policy, ...patch });
      showNotification(t('pool.policy_saved'), 'success');
    } catch (error) {
      showNotification(
        `${t('pool.policy_save_failed')} ${getErrorMessage(error, '')}`.trim(),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.policy}>
      <p>
        <b>{t('pool.policy_edit_title')}</b>
      </p>
      <div className={styles.chips} role="group" aria-label={t('pool.policy_edit_title')}>
        {STRATEGIES.map((strategy) => (
          <button
            key={strategy}
            type="button"
            className={styles.chip}
            aria-pressed={policy.strategy === strategy}
            disabled={disabled || saving}
            onClick={() => policy.strategy !== strategy && void save({ strategy })}
          >
            {t(`pool.policy_option_${strategy}`)}
          </button>
        ))}
      </div>
      <div className={styles.policyToggle}>
        <ToggleSwitch
          checked={policy.allowPaidFallback}
          disabled={disabled || saving}
          label={t('pool.policy_paid_fallback_label')}
          onChange={(checked) => void save({ allowPaidFallback: checked })}
        />
        <small>{t('pool.policy_paid_fallback_hint')}</small>
      </div>
    </div>
  );
}
