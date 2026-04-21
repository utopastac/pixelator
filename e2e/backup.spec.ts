import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

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

test.describe('Pixelator backup / restore', () => {
  test('Export all drawings from the DrawingsPanel kebab downloads a parseable envelope', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Open the panel, then its kebab menu.
    await page.getByTestId('open-drawings').click();
    await page.getByTestId('drawings-menu').click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('drawings-menu-export-all').click();
    const download = await downloadPromise;

    // Filename convention: pixelator-backup-YYYY-MM-DD.json
    expect(download.suggestedFilename()).toMatch(/^pixelator-backup-\d{4}-\d{2}-\d{2}\.json$/);

    const tmpPath = path.join(os.tmpdir(), `pixelator-backup-${Date.now()}.json`);
    await download.saveAs(tmpPath);
    const raw = await fs.readFile(tmpPath, 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed.format).toBe('pixelator-backup');
    expect(parsed.version).toBe(1);
    expect(parsed.scope).toBe('all');
    expect(typeof parsed.exportedAt).toBe('number');
    expect(Array.isArray(parsed.drawings)).toBe(true);
    expect(parsed.drawings.length).toBeGreaterThan(0);
    // Whole-store scope includes colour lists.
    expect(Array.isArray(parsed.recentColors)).toBe(true);
    expect(Array.isArray(parsed.customColors)).toBe(true);

    await fs.unlink(tmpPath).catch(() => {});
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Import drops a backup file into the hidden input and appends its drawings', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Count drawings before import.
    const beforeCount = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      return raw ? (JSON.parse(raw).drawings as unknown[]).length : 0;
    });

    // Hand-build a minimal valid envelope rather than round-tripping through
    // a download. Keeps the test independent of the export test's ordering
    // and the browser download flow.
    const envelope = {
      format: 'pixelator-backup',
      version: 1,
      scope: 'all',
      exportedAt: Date.now(),
      drawings: [
        {
          id: 'imported-1',
          name: 'Imported Drawing',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'imported-l1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: ['', '', '', '', '', '', '', '', '', '#ff00ff', '', '', '', '', '', ''],
            },
          ],
          activeLayerId: 'imported-l1',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      recentColors: ['#ff00ff'],
      customColors: ['#ff00ff'],
    };

    const tmpPath = path.join(os.tmpdir(), `pixelator-import-${Date.now()}.json`);
    await fs.writeFile(tmpPath, JSON.stringify(envelope));

    // The hidden input is rendered at the App root with a stable testid. We
    // don't click "Import…" (which would trigger the native OS picker) — we
    // set files on the input directly, which fires the same onChange handler.
    await page.getByTestId('import-file-input').setInputFiles(tmpPath);

    await expect
      .poll(async () => {
        const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
        if (!raw) return 0;
        return (JSON.parse(raw).drawings as unknown[]).length;
      })
      .toBe(beforeCount + 1);

    const loaded = await page.evaluate(() => {
      const raw = localStorage.getItem('pixelator.store');
      return raw ? JSON.parse(raw) : null;
    });
    // Imported drawing is at the front (matching appendDrawings behaviour)
    // and has a FRESH id — rewriteDrawingIds should have replaced 'imported-1'.
    const first = loaded.drawings[0];
    expect(first.name).toBe('Imported Drawing');
    expect(first.id).not.toBe('imported-1');
    expect(first.layers[0].pixels[9]).toBe('#ff00ff');

    await fs.unlink(tmpPath).catch(() => {});
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
