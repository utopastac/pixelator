import { MoonIcon, SunIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import type { Theme } from '@/hooks/useTheme';
import styles from './ThemeToggleControl.module.css';

export interface ThemeToggleControlProps {
  theme: Theme;
  onThemeToggle: () => void;
}

/** Moon in light mode (→ dark); sun in dark mode (→ light). */
export default function ThemeToggleControl({ theme, onThemeToggle }: ThemeToggleControlProps) {
  const isDark = theme === 'dark';
  const label = isDark ? 'Light mode' : 'Dark mode';
  return (
    <div className={styles.root}>
      <ToolbarButton
        icon={isDark ? SunIcon : MoonIcon}
        size="sm"
        onClick={onThemeToggle}
        aria-label={label}
        tooltip={{ content: label, placement: 'right' }}
        data-testid="theme-toggle"
      />
    </div>
  );
}
