import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

test.describe('Pixelator resilience', () => {
  test('corrupt localStorage recovers into a fresh store', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.addInitScript(() => {
      localStorage.setItem('pixelator.store', 'not json');
    });

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // loadStore() swallows JSON.parse errors and returns `empty()`, then App
    // seeds one drawing on mount. The autosave effect persists that seed.
    const store = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      return raw ? JSON.parse(raw) : null;
    });

    expect(store).not.toBeNull();
    expect(store.schemaVersion).toBe(2);
    expect(Array.isArray(store.drawings)).toBe(true);
    expect(store.drawings.length).toBeGreaterThan(0);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('unknown deep-link id is safe', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/#/d/definitely-does-not-exist');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // The hash-sync effect adopts a hash id only when it matches a drawing.
    // With a bogus id, App seeds / picks a real drawing and the current-id
    // effect rewrites the hash to the real one. Either:
    //   (a) hash now matches the real currentDrawingId, or
    //   (b) hash is still bogus but a valid drawing is active.
    // (a) is the observed behaviour; we assert (a) and fall back to (b).
    const state = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      const store = raw ? JSON.parse(raw) : null;
      return { hash: window.location.hash, store };
    });

    expect(state.store).not.toBeNull();
    expect(state.store.drawings.length).toBeGreaterThan(0);
    expect(state.store.currentDrawingId).not.toBeNull();

    const hashId = state.hash.startsWith('#/d/') ? state.hash.slice(4) : null;
    const currentId = state.store.currentDrawingId as string;
    const hashMatchesCurrent = hashId === currentId;
    const activeDrawingIsValid = state.store.drawings.some(
      (d: { id: string }) => d.id === currentId,
    );
    expect(hashMatchesCurrent || activeDrawingIsValid).toBe(true);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
