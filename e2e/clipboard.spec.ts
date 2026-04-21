import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end smoke for the Phase 1 clipboard (Copy / Cut / Paste). Seeds a
 * small drawing, uses the canvas context menu's "Select all" to place a
 * selection without simulating a drag, then exercises the keyboard paths
 * for Copy + Paste. Unit tests cover the helper logic in detail; this test
 * just proves the keyboard wiring hits the store through the real effect
 * stack.
 */

async function seedStore(page: Page, pixels: string[]) {
  const SEED = {
    schemaVersion: 2,
    drawings: [
      {
        id: 'clipboard-e2e',
        name: 'Clipboard',
        width: 4,
        height: 4,
        layers: [
          {
            id: 'layer-1',
            name: 'Background',
            visible: true,
            opacity: 1,
            pixels,
          },
        ],
        activeLayerId: 'layer-1',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ],
    currentDrawingId: 'clipboard-e2e',
  };
  await page.addInitScript((seed) => {
    localStorage.setItem('pixelator.store', JSON.stringify(seed));
  }, SEED);
}

test.describe('Pixelator clipboard', () => {
  test('Cmd+C followed by Cmd+V adds a pasted layer with the copied pixels', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); });

    // One red cell at (row=1, col=2) = index 6.
    const pixels = new Array<string>(16).fill('');
    pixels[6] = '#ff0000';
    await seedStore(page, pixels);

    await page.goto('/');
    const canvas = page.getByTestId('editor-canvas');
    await expect(canvas).toBeVisible();

    // Use the canvas context menu to select all — simpler than issuing a drag.
    await canvas.click({ button: 'right' });
    await page.getByTestId('canvas-menu-select-all').click();

    // Menu click leaves focus on a removed button; move it back to body so
    // document-level keydown picks up our shortcut presses.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').click({ position: { x: 1, y: 1 } });

    // Fire both Meta+ and Control+ variants so the test works on either
    // platform the shortcut hook's userAgent check resolves to.
    await page.keyboard.press('Meta+c');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Meta+v');
    await page.keyboard.press('Control+v');

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const d = parsed.drawings.find((x: { id: string }) => x.id === 'clipboard-e2e');
      return d?.layers.length ?? null;
    }, { timeout: 2000 }).toBe(2);

    const loaded = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      return raw ? JSON.parse(raw) : null;
    });
    const drawing = loaded.drawings[0];
    // Two layers: original Background + pasted clip.
    expect(drawing.layers).toHaveLength(2);
    // The pasted layer preserves the red cell at the same index — Select all
    // covers the full canvas so the anchor is (0, 0) and coordinates are 1:1.
    const pasted = drawing.layers[1];
    expect(pasted.pixels[6]).toBe('#ff0000');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
