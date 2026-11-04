import type { ReactNode } from 'react';
import { IconAlertTriangle, IconInfo } from '@/components/ui/icons';
import styles from '../pool.module.scss';

interface NoticeProps {
  tone?: 'warning' | 'critical' | 'info';
  title: string;
  children?: ReactNode;
}

export function Notice({ tone = 'warning', title, children }: NoticeProps) {
  const className = [
    styles.notice,
    tone === 'critical' ? styles.noticeCritical : '',
    tone === 'info' ? styles.noticeInfo : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className} role={tone === 'info' ? undefined : 'status'}>
      {tone === 'info' ? <IconInfo size={16} /> : <IconAlertTriangle size={16} />}
      <div>
        <p>{title}</p>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}
