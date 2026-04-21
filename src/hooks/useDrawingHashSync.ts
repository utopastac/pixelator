import { useEffect } from 'react';

/**
 * Two-way sync between `currentDrawingId` and `window.location.hash`.
 *
 *   #/d/abc123
 *
 * Behaviour:
 * - On mount: if the URL hash names a valid drawing, select it (deep-link
 *   wins over the localStorage-restored selection).
 * - When `currentDrawingId` changes (user clicks a row): push the matching
 *   hash, so the browser back/forward buttons navigate between drawings.
 * - On `hashchange` (back/forward, manual URL edit): re-select if the hash
 *   names a valid drawing.
 *
 * The write effect's echo (set-hash → hashchange → onSelect) is a no-op
 * because `onSelect` with an already-current id doesn't change state. No
 * loop guard needed.
 */

const HASH_PREFIX = '#/d/';

function readDrawingIdFromHash(): string | null {
  const raw = window.location.hash;
  if (!raw.startsWith(HASH_PREFIX)) return null;
  const rest = raw.slice(HASH_PREFIX.length);
  // Allow further path segments (e.g. a future `#/d/abc/layer/xyz`) by
  // stopping at the next `/`.
  const slash = rest.indexOf('/');
  const id = slash >= 0 ? rest.slice(0, slash) : rest;
  return id || null;
}

function writeDrawingIdToHash(id: string | null) {
  const next = id ? `${HASH_PREFIX}${id}` : '';
  if (window.location.hash === next) return;
  // Use assignment so each switch pushes a history entry — back/forward walks
  // between drawings. `replaceState` on mount avoids creating a duplicate
  // entry for whatever hash was already there.
  window.location.hash = next;
}

interface Args {
  drawings: { id: string }[];
  currentDrawingId: string | null;
  onSelect: (id: string) => void;
}

/** Syncs `currentDrawingId` ↔ `window.location.hash` (`#/d/<id>`).
 *  On mount, a valid hash takes priority over the localStorage-restored id;
 *  each subsequent selection pushes a history entry so back/forward navigate. */
export function useDrawingHashSync({ drawings, currentDrawingId, onSelect }: Args) {
  // Mount-only: adopt the URL's drawing id if it's valid.
  useEffect(() => {
    const id = readDrawingIdFromHash();
    if (id && drawings.some((d) => d.id === id) && id !== currentDrawingId) {
      onSelect(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to user-driven hash changes (back/forward, pasted URL).
  useEffect(() => {
    const handler = () => {
      const id = readDrawingIdFromHash();
      if (id && drawings.some((d) => d.id === id)) {
        onSelect(id);
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [drawings, onSelect]);

  // Mirror the current selection into the hash.
  useEffect(() => {
    if (currentDrawingId) writeDrawingIdToHash(currentDrawingId);
  }, [currentDrawingId]);
}
