import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

const KEY = 'pixelator.theme';

export type Theme = 'light' | 'dark';

function systemDefault(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function load(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* localStorage unavailable — fall through */
  }
  return systemDefault();
}

export interface UseTheme {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

/**
 * App-wide light/dark theme. Writes `data-theme` on the document element so
 * `[data-theme="dark"]` overrides in tokens.css apply globally. First-load
 * default is the user's OS `prefers-color-scheme`; any explicit choice is
 * persisted under `pixelator.theme` and survives reloads.
 *
 * Applied via `useLayoutEffect` so the attribute is set before the browser
 * paints — avoids a light-then-dark flash for users whose stored theme is
 * dark. Lazy initializer reads localStorage synchronously on first render.
 */
export function useTheme(): UseTheme {
  const [theme, setThemeState] = useState<Theme>(load);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* quota / disabled storage — non-fatal */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
