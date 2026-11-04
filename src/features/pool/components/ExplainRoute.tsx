import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { reasonLabel } from '../format';
import { usePoolExplain } from '../hooks/usePoolExplain';
import styles from '../pool.module.scss';

/** Ask the backend which account would serve a model right now, and why the others would not. */
export function ExplainRoute() {
  const { t } = useTranslation();
  const [model, setModel] = useState('');
  const { status, result, error, explain } = usePoolExplain();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void explain(model);
  };

  return (
    <div className={styles.section}>
      <form className={styles.explainForm} onSubmit={submit}>
        <input
          className={styles.explainInput}
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={t('pool.explain_placeholder')}
          aria-label={t('pool.explain_placeholder')}
        />
        <button type="submit" className={styles.primaryAction} disabled={!model.trim() || status === 'loading'}>
          {t('pool.explain_submit')}
        </button>
      </form>
      {status === 'unsupported' ? (
        <p className={styles.sectionNote}>{t('pool.backend_old_explain')}</p>
      ) : null}
      {status === 'error' && error ? <p className={styles.sectionNote}>{error}</p> : null}
      {status === 'ready' && result ? (
        <>
          <p className={styles.sectionNote}>
            {result.selectedAccountId
              ? t('pool.explain_selected', {
                  account:
                    result.candidates.find((candidate) => candidate.id === result.selectedAccountId)?.label ??
                    result.selectedAccountId,
                })
              : result.tiedAccountIds.length > 1
                ? t('pool.explain_tied', {
                    accounts: result.tiedAccountIds
                      .map((id) => result.candidates.find((candidate) => candidate.id === id)?.label ?? id)
                      .join(', '),
                  })
                : t('pool.explain_none')}
            {result.reason ? ` · ${reasonLabel(t, result.reason)}` : ''}
          </p>
          <ul className={styles.candidates}>
            {result.candidates.map((candidate) => (
              <li
                key={candidate.id}
                className={styles.candidate}
                data-selected={
                  candidate.id === result.selectedAccountId || result.tiedAccountIds.includes(candidate.id)
                }
              >
                <i
                  className={styles.rowDot}
                  data-tone={candidate.eligible ? 'good' : 'muted'}
                  style={{ '--dot-tone': candidate.eligible ? 'var(--tone-good)' : 'var(--tone-muted)' } as React.CSSProperties}
                  aria-hidden="true"
                />
                <span className={styles.candidateLabel}>{candidate.label}</span>
                <span className={styles.candidateReason}>
                  {candidate.eligible ? t('pool.explain_eligible') : reasonLabel(t, candidate.reason) || t('pool.explain_ineligible')}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
