import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Attach a console.error listener that pushes errors into the returned array.
 * Tests assert on that array at the end. We deliberately don't fail inside the
 * listener so the test can print *all* errors that happened, not just the first.
 */
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

test.describe('Pixelator smoke', () => {
  test('cold boot renders editor canvas with no console errors', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/');

    // The editor renders two <canvas> elements (committed + preview) inside
    // its canvas inner wrapper. First one is the committed layer canvas.
    const canvas = page.getByTestId('editor-canvas');
    await expect(canvas).toBeVisible();

    // Autosave runs on mount (the app seeds a drawing if storage is empty),
    // so by the time we get here localStorage should have a v2 store.
    const store = await page.evaluate(() => localStorage.getItem('pixelator.store'));
    expect(store).not.toBeNull();
    const parsed = JSON.parse(store!);
    expect(parsed.schemaVersion).toBe(2);
    expect(Array.isArray(parsed.drawings)).toBe(true);
    expect(parsed.drawings.length).toBeGreaterThan(0);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('paint persists across reload (seeded via localStorage)', async ({ page }) => {
    // Rationale: the editor uses a CSS-transformed canvas (scale + translate)
    // and multiple offscreen canvases composited into the visible one. Clicking
    // at a screen coordinate to land on cell (r,c) is fragile — viewport auto-
    // fit math, pan and zoom can shift things. The real concerns this test
    // covers are: (1) the editor hydrates a persisted layer stack correctly,
    // and (2) a non-empty layer survives a reload. We validate both by seeding
    // the store directly and asserting the editor boots into that drawing.

    // Visit once so React mounts and the app seeds a drawing. We then
    // overwrite with our own known-good store and reload.
    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Craft a 4x4 drawing with one red pixel at (row=2, col=1) → index 9.
    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-drawing-1',
          name: 'Seeded',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: ['', '', '', '', '', '', '', '', '', '#ff0000', '', '', '', '', '', ''],
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-drawing-1',
    };

    await page.evaluate((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
    }, SEED);

    // Past the 300ms debounce window so any in-flight autosave can't clobber us.
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    const loaded = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      return raw ? JSON.parse(raw) : null;
    });

    expect(loaded).not.toBeNull();
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.drawings).toHaveLength(1);

    const d = loaded.drawings[0];
    expect(d.id).toBe('test-drawing-1');
    expect(d.width).toBe(4);
    expect(d.height).toBe(4);
    expect(d.layers).toHaveLength(1);
    expect(d.layers[0].pixels[9]).toBe('#ff0000');
    expect(loaded.currentDrawingId).toBe('test-drawing-1');
  });

  test('SVG export triggers a download with non-empty content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Open the Download menu. The button carries data-testid="download-menu".
    await page.getByTestId('download-menu').click();

    // Click the "Download SVG" menu item by its stable testid.
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-svg').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.svg$/i);

    const tmpPath = path.join(os.tmpdir(), `pixelator-e2e-${Date.now()}.svg`);
    await download.saveAs(tmpPath);
    const stat = await fs.stat(tmpPath);
    expect(stat.size).toBeGreaterThan(0);
    await fs.unlink(tmpPath).catch(() => {});
  });

  test('PNG export triggers a download with non-empty content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Same menu as the SVG test — Download opens a menu with an SVG entry,
    // a PngScalePicker row (inline scale chips), and a layers-SVG entry.
    await page.getByTestId('download-menu').click();

    // Each PngScalePicker chip has `data-testid="png-scale-<n>"`. Pick 1× for speed.
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('png-scale-1').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    const tmpPath = path.join(os.tmpdir(), `pixelator-e2e-${Date.now()}.png`);
    await download.saveAs(tmpPath);
    const stat = await fs.stat(tmpPath);
    expect(stat.size).toBeGreaterThan(0);
    await fs.unlink(tmpPath).catch(() => {});
  });

  test('resize via canvas size picker preserves drawing identity', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); });

    // Seed a known 4×4 drawing (mirrors the paint-persistence test).
    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-resize-1',
          name: 'Resize me',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: ['', '', '', '', '', '', '', '', '', '#00ff00', '', '', '', '', '', ''],
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-resize-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Title panel renders a ReadoutButton with data-testid="canvas-size-picker".
    // Opens a menu of square presets + custom row.
    await page.getByTestId('canvas-size-picker').click();

    // Pick the 16 × 16 preset (PopoverMenuItem with data-testid="size-preset-16").
    await page.getByTestId('size-preset-16').click();

    // Past the autosave debounce (300ms) — resize persists through the
    // normal path so give it headroom.
    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const active = parsed.drawings.find(
        (d: { id: string }) => d.id === parsed.currentDrawingId,
      );
      return active ? { w: active.width, h: active.height } : null;
    }).toEqual({ w: 16, h: 16 });

    const loaded = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      return raw ? JSON.parse(raw) : null;
    });
    const d = loaded.drawings[0];
    expect(d.name).toBe('Resize me');
    expect(d.layers.length).toBeGreaterThan(0);
    expect(d.layers[0].pixels.length).toBe(16 * 16);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Cmd+Z undoes a Clear layer action', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); });

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-undo-1',
          name: 'Undo me',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: ['', '', '', '', '', '', '', '', '', '#123456', '', '', '', '', '', ''],
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-undo-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
    }, SEED);

    await page.goto('/');
    const canvas = page.getByTestId('editor-canvas');
    await expect(canvas).toBeVisible();

    // Right-click the canvas area → canvas context menu (PixelArtEditor.tsx).
    await canvas.click({ button: 'right' });
    await page.getByTestId('canvas-menu-clear-layer').click();

    // Past the 300ms autosave debounce so the Clear result is flushed.
    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const d = parsed.drawings.find((x: { id: string }) => x.id === 'test-undo-1');
      // After Clear, the painted cell should be '' (empty pixel).
      return d?.layers[0].pixels[9] ?? null;
    }, { timeout: 2000 }).toBe('');

    // The menuitem click leaves focus on a now-removed button, so move focus
    // back to the body before firing the keyboard shortcut.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').click({ position: { x: 1, y: 1 } });

    // Cmd+Z (mac) / Ctrl+Z (other) — editor detects via navigator.userAgent.
    // Send both to cover all platforms the CI might run on.
    await page.keyboard.press('Meta+z');
    await page.keyboard.press('Control+z');

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const d = parsed.drawings.find((x: { id: string }) => x.id === 'test-undo-1');
      return d?.layers[0].pixels[9] ?? null;
    }, { timeout: 2000 }).toBe('#123456');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Cmd+Shift+Z redoes a Clear layer action', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); });

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-redo-1',
          name: 'Redo me',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: ['', '', '', '', '', '', '', '', '', '#123456', '', '', '', '', '', ''],
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-redo-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
    }, SEED);

    await page.goto('/');
    const canvas = page.getByTestId('editor-canvas');
    await expect(canvas).toBeVisible();

    // Clear the layer via the canvas context menu.
    await canvas.click({ button: 'right' });
    await page.getByTestId('canvas-menu-clear-layer').click();

    // Wait for the Clear to flush to localStorage (pixel 9 should be empty).
    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const d = parsed.drawings.find((x: { id: string }) => x.id === 'test-redo-1');
      return d?.layers[0].pixels[9] ?? null;
    }, { timeout: 2000 }).toBe('');

    // Restore focus to body before firing keyboard shortcuts.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').click({ position: { x: 1, y: 1 } });

    // Undo (Cmd+Z / Ctrl+Z) — restores #123456.
    await page.keyboard.press('Meta+z');
    await page.keyboard.press('Control+z');

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const d = parsed.drawings.find((x: { id: string }) => x.id === 'test-redo-1');
      return d?.layers[0].pixels[9] ?? null;
    }, { timeout: 2000 }).toBe('#123456');

    // Redo (Cmd+Shift+Z / Ctrl+Shift+Z) — re-applies the Clear, pixel 9 becomes '' again.
    await page.keyboard.press('Meta+Shift+z');
    await page.keyboard.press('Control+Shift+z');

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const d = parsed.drawings.find((x: { id: string }) => x.id === 'test-redo-1');
      return d?.layers[0].pixels[9] ?? null;
    }, { timeout: 2000 }).toBe('');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
