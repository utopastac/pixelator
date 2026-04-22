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

type StoredDrawing = { id: string; name: string; layers: { pixels: string[] }[] };
type StoredStore = {
  schemaVersion: number;
  drawings: StoredDrawing[];
  currentDrawingId: string | null;
};

async function readStore(page: Page): Promise<StoredStore> {
  const raw = await page.evaluate(() => localStorage.getItem('pixelator.store'));
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as StoredStore;
}

test.describe('Pixelator drawings CRUD', () => {
  test('create, switch between, and delete drawings', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    // Suppress first-launch seed so the test starts with a single blank
    // drawing. The seed flag is versioned — any value >= SEED_VERSION works,
    // so use a high number to avoid re-breaking this when SEED_VERSION bumps.
    await page.addInitScript(() => {
      window.localStorage.setItem('pixelator.seeded', '9999');
    });

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Mount + autosave seed a single drawing.
    await expect.poll(async () => (await readStore(page)).drawings.length).toBe(1);
    const firstId = (await readStore(page)).currentDrawingId!;
    expect(firstId).toBeTruthy();

    // DrawingsPanel starts closed. Open via hamburger (App.tsx).
    await page.getByTestId('open-drawings').click();

    // Create a new drawing.
    await page.getByTestId('new-drawing').click();

    await expect.poll(async () => (await readStore(page)).drawings.length).toBe(2);
    const afterCreate = await readStore(page);
    const newId = afterCreate.currentDrawingId!;
    expect(newId).not.toBe(firstId);

    // Hash sync pushes the current id into the URL.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#/d/${newId}`);

    // Click the OTHER drawing's row by its id. Rows carry `data-drawing-id`
    // specifically to let tests target a specific drawing without depending
    // on the user-supplied name (both defaults are "Untitled").
    await page.locator(`[data-drawing-id="${firstId}"]`).click();

    await expect.poll(async () => (await readStore(page)).currentDrawingId).toBe(firstId);

    // Delete the currently-selected drawing via its per-row overflow menu.
    // Multiple rows all show `data-testid="drawing-actions"` — use .first()
    // which targets the top (new) drawing. We selected firstId above so the
    // visually-active row is further down; open the menu on the top row
    // instead and delete that one, then assert the survivor is firstId.
    await page.getByTestId('drawing-actions').first().click();
    await page.getByTestId('drawing-menu-delete').click();

    // A ConfirmDialog now guards Delete — confirm it to complete the action.
    await expect(page.getByTestId('confirm-delete-drawing')).toBeVisible();
    await page.getByTestId('confirm-dialog-confirm').click();

    await expect.poll(async () => (await readStore(page)).drawings.length).toBe(1);
    const afterDelete = await readStore(page);
    expect(afterDelete.drawings[0].id).toBe(firstId);
    expect(afterDelete.currentDrawingId).toBe(firstId);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Duplicate drawing creates a copy with the same content', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-dup-1',
          name: 'Original',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: ['', '', '', '', '', '', '', '', '', '#abcdef', '', '', '', '', '', ''],
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-dup-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    await page.getByTestId('open-drawings').click();
    await page.getByTestId('drawing-actions').first().click();
    await page.getByTestId('drawing-menu-duplicate').click();

    await expect.poll(async () => (await readStore(page)).drawings.length).toBe(2);

    const store = await readStore(page);
    const copy = store.drawings.find((d) => d.id !== 'test-dup-1');
    expect(copy).toBeDefined();
    expect(copy!.name).toContain('Original');
    expect(copy!.layers[0].pixels[9]).toBe('#abcdef');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Double-clicking a drawing name renames it', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-rename-1',
          name: 'My Drawing',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: Array(16).fill(''),
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-rename-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Open the DrawingsPanel.
    await page.getByTestId('open-drawings').click();

    // Double-click the drawing name label to enter edit mode.
    await page.getByRole('button', { name: 'Rename drawing My Drawing' }).dblclick();

    // EditableText renders an input with the same aria-label in edit mode.
    const input = page.getByRole('textbox', { name: 'Rename drawing My Drawing' });
    await input.fill('Renamed Drawing');
    await input.press('Enter');

    // Wait for the renamed drawing to appear in localStorage.
    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-rename-1');
      return d?.name ?? null;
    }, { timeout: 2000 }).toBe('Renamed Drawing');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Drawing title can be renamed via the EditorBars inline editor', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-title-rename-1',
          name: 'Canvas Title',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: Array(16).fill(''),
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-title-rename-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // The title chrome EditableText uses ariaLabel="Drawing name" in static mode.
    await page.getByRole('button', { name: 'Drawing name' }).dblclick();

    const input = page.getByRole('textbox', { name: 'Drawing name' });
    await input.fill('New Title');
    await input.press('Enter');

    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-title-rename-1');
      return d?.name ?? null;
    }, { timeout: 2000 }).toBe('New Title');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
