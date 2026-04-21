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

test.describe('Pixelator theme toggle', () => {
  test('theme toggle flips data-theme and persists across reload', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(initialTheme === 'light' || initialTheme === 'dark').toBe(true);
    const expected = initialTheme === 'dark' ? 'light' : 'dark';

    // The toggle carries a state-dependent aria-label; target the stable testid
    // instead so the test doesn't care which label is live.
    await page.getByTestId('theme-toggle').click();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe(expected);

    // useTheme persists under pixelator.theme; give it a tick to flush.
    await page.waitForTimeout(50);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('pixelator.theme'))).toBe(
      expected,
    );

    await page.reload();
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe(expected);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
