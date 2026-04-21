import { useCallback, useEffect, useState } from 'react';

const KEY = 'pixelator:customColors';
const HEX = /^#[0-9a-fA-F]{6}$/;

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && HEX.test(s));
  } catch {
    return [];
  }
}

export interface UseCustomColors {
  /** Global list of custom hex colours the user has committed via the "+"
   *  picker. Shared across all drawings. Order is insertion-order. */
  customColors: string[];
  /** Append a colour to the end of the list, deduping by hex (case-insensitive).
   *  Invalid hex values are silently ignored. */
  pushCustomColor: (color: string) => void;
  /** Remove a colour from the list, matching case-insensitively. */
  removeCustomColor: (color: string) => void;
  /**
   * Merge an imported list of custom colours. New entries are appended in
   * order; duplicates (case-insensitive) are skipped. Invalid hex values are
   * silently dropped.
   */
  mergeCustomColors: (incoming: string[]) => void;
}

/**
 * localStorage-backed global list of user-added custom colours. Parallel to
 * `useRecentColors` but intended for a different purpose: these are swatches
 * the user explicitly chose to save, and they persist until removed.
 */
export function useCustomColors(): UseCustomColors {
  const [customColors, setCustomColors] = useState<string[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(customColors));
    } catch {
      /* quota errors etc are non-fatal */
    }
  }, [customColors]);

  const pushCustomColor = useCallback((color: string) => {
    if (!HEX.test(color)) return;
    const normalized = color.toLowerCase();
    setCustomColors((prev) => {
      if (prev.some((c) => c.toLowerCase() === normalized)) return prev;
      return [...prev, normalized];
    });
  }, []);

  const removeCustomColor = useCallback((color: string) => {
    const normalized = color.toLowerCase();
    setCustomColors((prev) => prev.filter((c) => c.toLowerCase() !== normalized));
  }, []);

  const mergeCustomColors = useCallback((incoming: string[]) => {
    const valid = incoming
      .filter((c): c is string => typeof c === 'string' && HEX.test(c))
      .map((c) => c.toLowerCase());
    if (valid.length === 0) return;
    setCustomColors((prev) => {
      const seen = new Set(prev.map((c) => c.toLowerCase()));
      const additions: string[] = [];
      for (const c of valid) {
        if (seen.has(c)) continue;
        seen.add(c);
        additions.push(c);
      }
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
  }, []);

  return { customColors, pushCustomColor, removeCustomColor, mergeCustomColors };
}
