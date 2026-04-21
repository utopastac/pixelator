import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('editor-canvas')).toBeVisible();
}

test.describe('Panel visibility toggle', () => {
  test('all panels are visible on load', async ({ page }) => {
    await boot(page);

    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).toBeVisible();
    await expect(page.getByLabel('Drawing title')).toBeVisible();
    await expect(page.getByLabel('Layers')).toBeVisible();
    await expect(page.getByTestId('open-drawings')).toBeVisible();
    // Help panel always stays visible
    await expect(page.getByLabel('Help')).toBeVisible();
    // Canvas always visible
    await expect(page.getByTestId('editor-canvas')).toBeVisible();
  });

  test('backslash hides all panels except the help pill and canvas', async ({ page }) => {
    await boot(page);

    await page.keyboard.press('\\');

    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).not.toBeVisible();
    await expect(page.getByLabel('Drawing title')).not.toBeVisible();
    await expect(page.getByLabel('Layers')).not.toBeVisible();
    await expect(page.getByTestId('open-drawings')).not.toBeVisible();
    // Canvas and help pill remain
    await expect(page.getByTestId('editor-canvas')).toBeVisible();
    await expect(page.getByLabel('Help')).toBeVisible();
  });

  test('backslash a second time restores all panels', async ({ page }) => {
    await boot(page);

    await page.keyboard.press('\\');
    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).not.toBeVisible();

    await page.keyboard.press('\\');

    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).toBeVisible();
    await expect(page.getByLabel('Drawing title')).toBeVisible();
    await expect(page.getByLabel('Layers')).toBeVisible();
    await expect(page.getByTestId('open-drawings')).toBeVisible();
  });

  test('toggle button in help pill hides and shows panels', async ({ page }) => {
    await boot(page);

    await page.getByTestId('toggle-panels').click();
    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).not.toBeVisible();

    await page.getByTestId('toggle-panels').click();
    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).toBeVisible();
  });

  test('backslash inside a text input does not toggle panels', async ({ page }) => {
    await boot(page);

    // Focus any INPUT element on the page (e.g. a hidden file input won't work —
    // instead create one via evaluate so we have a reliably focused input).
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      document.body.appendChild(input);
      input.focus();
    });

    await page.keyboard.press('\\');

    // Panels should still be visible — the shortcut was suppressed.
    await expect(page.getByRole('toolbar', { name: 'Pixel art tools' })).toBeVisible();
  });
});
