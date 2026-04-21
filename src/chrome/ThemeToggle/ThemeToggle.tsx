import { MoonIcon, SunIcon } from '@/editor/icons/PixelToolIcons';
import ToolbarButton from '@/primitives/ToolbarButton';
import type { Theme } from '@/hooks/useTheme';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

/** Thin wrapper around ToolbarButton. Shows a Moon when in light mode (click
 *  to go dark) and a Sun when in dark mode (click to go light). */
export default function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === 'dark';
  const label = isDark ? 'Light mode' : 'Dark mode';
  return (
    <ToolbarButton
      icon={isDark ? SunIcon : MoonIcon}
      size="sm"
      onClick={onToggle}
      aria-label={label}
      tooltip={{ content: label, placement: 'right' }}
      data-testid="theme-toggle"
    />
  );
}
