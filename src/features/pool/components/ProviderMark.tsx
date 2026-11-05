import { useThemeStore } from '@/stores';
import { getAuthFileIcon, THEME_SURFACE_ICON_PROVIDERS } from '@/features/authFiles/constants';
import styles from '../pool.module.scss';

/** Provider logo when the app ships one, otherwise the provider's initial. */
export function ProviderMark({ provider, label }: { provider: string; label: string }) {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const icon = getAuthFileIcon(provider, resolvedTheme);
  return (
    <span
      className={styles.mark}
      aria-hidden="true"
      data-surface={THEME_SURFACE_ICON_PROVIDERS.has(provider) ? 'theme' : undefined}
    >
      {icon ? <img src={icon} alt="" /> : label.charAt(0).toUpperCase()}
    </span>
  );
}
