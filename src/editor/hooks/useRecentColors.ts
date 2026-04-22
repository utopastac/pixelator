import { useCallback, useEffect, useState } from 'react';

const KEY = 'pixelator.recentColors';
const MAX = 15;
const HEX = /^#[0-9a-fA-F]{6}$/;
const SEED: string[] = ['#000000', '#ffffff'];

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...SEED];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...SEED];
    return parsed.filter((s): s is string => typeof s === 'string' && HEX.test(s)).slice(0, MAX);
  } catch {
    return [...SEED];
  }
}

export interface UseRecentColors {
  /** Most-recent-first list of distinct hex colours the user has picked. */
  recents: string[];
  /** Add a colour to the front of the list, deduping by hex (case-insensitive). */
  pushRecent: (color: string) => void;
  /**
   * Merge an imported list of colours into the recents. Incoming colours are
   * de-duped against the existing list (case-insensitive) and appended
   * after — existing recents keep their positions — then the whole thing is
   * clamped to the cap. Invalid hex entries are silently dropped.
   */
  mergeRecentColors: (incoming: string[]) => void;
}

/**
 * localStorage-backed rolling list of recently-picked colours (cap 15).
 * Call `pushRecent` whenever the user commits to a new colour.
 */
export function useRecentColors(): UseRecentColors {
  const [recents, setRecents] = useState<string[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(recents));
    } catch {
      /* quota errors etc are non-fatal */
    }
  }, [recents]);

  const pushRecent = useCallback((color: string) => {
    if (!HEX.test(color)) return;
    const normalized = color.toLowerCase();
    setRecents((prev) => {
      // Picking an existing recent leaves the list as-is — only genuinely new
      // colours bump to the front. Avoids disorienting reorders when the user
      // clicks through existing swatches.
      if (prev.some((c) => c.toLowerCase() === normalized)) return prev;
      return [normalized, ...prev].slice(0, MAX);
    });
  }, []);

  const mergeRecentColors = useCallback((incoming: string[]) => {
    const valid = incoming
      .filter((c): c is string => typeof c === 'string' && HEX.test(c))
      .map((c) => c.toLowerCase());
    if (valid.length === 0) return;
    setRecents((prev) => {
      const seen = new Set(prev.map((c) => c.toLowerCase()));
      const additions: string[] = [];
      for (const c of valid) {
        if (seen.has(c)) continue;
        seen.add(c);
        additions.push(c);
      }
      if (additions.length === 0) return prev;
      return [...prev, ...additions].slice(0, MAX);
    });
  }, []);

  return { recents, pushRecent, mergeRecentColors };
}
