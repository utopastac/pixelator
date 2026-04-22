import { test, expect } from '@playwright/test';

test.describe('Active color persistence', () => {
  test('active color restores from recent colors on reload', async ({ page }) => {
    // Seed a known recent color as the most recently used.
    await page.addInitScript(() => {
      localStorage.setItem(
        'pixelator.recentColors',
        JSON.stringify(['#ff6600', '#000000', '#ffffff']),
      );
    });

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Open the color picker.
    await page.getByRole('button', { name: 'Colors', exact: true }).click();

    // The hex input should reflect the most recent color, not the palette default.
    await expect(page.locator('#hex-color-input')).toHaveValue('ff6600');
  });

  test('active color defaults to black when no recent colors exist', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('pixelator.recentColors');
    });

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Colors', exact: true }).click();

    // With no recents, seeds fall back to #000000 (SEED[0] in useRecentColors).
    await expect(page.locator('#hex-color-input')).toHaveValue('000000');
  });
});
