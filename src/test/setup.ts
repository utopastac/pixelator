/**
 * Vitest global setup. Loaded via `vite.config.ts` → `test.setupFiles`.
 *
 * Extends Vitest's `expect` with jest-dom matchers (`toBeInTheDocument`,
 * `toHaveAttribute`, etc.) so DOM-level assertions read naturally in
 * component tests.
 */
import '@testing-library/jest-dom/vitest';
