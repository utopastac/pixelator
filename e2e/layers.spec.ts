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

type StoredLayer = { id: string; name: string; visible: boolean; opacity: number; pixels: string[] };
type StoredDrawing = { id: string; name: string; layers: StoredLayer[] };
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

const EMPTY_4X4_PIXELS = Array(16).fill('');

test.describe('Pixelator layers', () => {
  test('Add layer button creates a new layer and it persists', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-layers-add-1',
          name: 'Layer add test',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: EMPTY_4X4_PIXELS,
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-layers-add-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Click the Add layer button in the LayersPanel.
    await page.getByRole('button', { name: 'Add layer' }).click();

    // Wait for the new layer to appear in localStorage.
    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-layers-add-1');
      return d?.layers.length ?? 0;
    }, { timeout: 2000 }).toBe(2);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Layer visibility toggle hides/shows a layer', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-layers-vis-1',
          name: 'Visibility test',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: EMPTY_4X4_PIXELS,
            },
            {
              id: 'layer-2',
              name: 'Foreground',
              visible: true,
              opacity: 1,
              pixels: EMPTY_4X4_PIXELS,
            },
          ],
          activeLayerId: 'layer-2',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-layers-vis-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // The first "Hide layer" button corresponds to the top-displayed layer (Foreground / layer-2).
    await page.getByRole('button', { name: 'Hide layer' }).first().click();

    // Wait for that layer to become invisible in localStorage.
    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-layers-vis-1');
      const layer = d?.layers.find((l) => l.id === 'layer-2');
      return layer?.visible ?? null;
    }, { timeout: 2000 }).toBe(false);

    // Click "Show layer" to make it visible again.
    await page.getByRole('button', { name: 'Show layer' }).first().click();

    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-layers-vis-1');
      const layer = d?.layers.find((l) => l.id === 'layer-2');
      return layer?.visible ?? null;
    }, { timeout: 2000 }).toBe(true);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Double-clicking a layer name renames it', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-layers-rename-1',
          name: 'Layer rename test',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: EMPTY_4X4_PIXELS,
            },
          ],
          activeLayerId: 'layer-1',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-layers-rename-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Rename layer Background' }).dblclick();

    const input = page.getByRole('textbox', { name: 'Rename layer Background' });
    await input.fill('Linework');
    await input.press('Enter');

    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-layers-rename-1');
      return d?.layers[0].name ?? null;
    }, { timeout: 2000 }).toBe('Linework');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Drag reorders layers and persists to storage', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-drag-reorder-1',
          name: 'Drag reorder test',
          width: 4,
          height: 4,
          layers: [
            { id: 'layer-bottom', name: 'Bottom', visible: true, opacity: 1, pixels: EMPTY_4X4_PIXELS },
            { id: 'layer-middle', name: 'Middle', visible: true, opacity: 1, pixels: EMPTY_4X4_PIXELS },
            { id: 'layer-top', name: 'Top', visible: true, opacity: 1, pixels: EMPTY_4X4_PIXELS },
          ],
          activeLayerId: 'layer-top',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-drag-reorder-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Display order is reversed from array: Top (display 0), Middle (1), Bottom (2).
    // Drag the Bottom row's grip up above the Top row → drop slot 0 → moves
    // layer-bottom to the highest array index (top of the render stack).
    const topRow = page.getByRole('button', { name: 'Layer Top', exact: true });
    const bottomRow = page.getByRole('button', { name: 'Layer Bottom', exact: true });

    const topBox = await topRow.boundingBox();
    const bottomBox = await bottomRow.boundingBox();
    expect(topBox).not.toBeNull();
    expect(bottomBox).not.toBeNull();

    const startX = bottomBox!.x + 8; // grip is at the left edge of the row
    const startY = bottomBox!.y + bottomBox!.height / 2;
    const endY = topBox!.y - 12; // above the top row → drop slot 0

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 6); // cross the 4px activation threshold
    await page.mouse.move(startX, endY, { steps: 10 });
    await page.mouse.up();

    // layer-bottom should now be the last element in the array (top of the stack).
    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-drag-reorder-1');
      return d?.layers.at(-1)?.id ?? null;
    }, { timeout: 2000 }).toBe('layer-bottom');

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Alt-drag duplicates a layer to the target slot', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-drag-duplicate-1',
          name: 'Drag duplicate test',
          width: 4,
          height: 4,
          layers: [
            { id: 'layer-a', name: 'LayerA', visible: true, opacity: 1, pixels: EMPTY_4X4_PIXELS },
            { id: 'layer-b', name: 'LayerB', visible: true, opacity: 1, pixels: EMPTY_4X4_PIXELS },
          ],
          activeLayerId: 'layer-b',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-drag-duplicate-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Display order: LayerB (display 0), LayerA (display 1).
    // Alt-drag LayerA (bottom of list) up above LayerB → duplicates it to the top slot.
    const topRow = page.getByRole('button', { name: 'Layer LayerB', exact: true });
    const bottomRow = page.getByRole('button', { name: 'Layer LayerA', exact: true });

    const topBox = await topRow.boundingBox();
    const bottomBox = await bottomRow.boundingBox();
    expect(topBox).not.toBeNull();
    expect(bottomBox).not.toBeNull();

    const startX = bottomBox!.x + 8;
    const startY = bottomBox!.y + bottomBox!.height / 2;
    const endY = topBox!.y - 12;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 6);
    await page.keyboard.down('Alt');
    await page.mouse.move(startX, endY, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    // A duplicate is inserted → layer count increases from 2 to 3.
    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-drag-duplicate-1');
      return d?.layers.length ?? null;
    }, { timeout: 2000 }).toBe(3);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Drag resize handle left expands the panel and persists width', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    const panel = page.getByLabel('Layers', { exact: true });
    const handle = page.getByTestId('layers-panel-resize');

    const panelBox = await panel.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(handleBox).not.toBeNull();

    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    // Move 80px left → dx = 80 → new width ≈ 272 + 80 = 352
    const endX = startX - 80;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 6, startY); // cross the 4px activation threshold
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    const newPanelBox = await panel.boundingBox();
    expect(newPanelBox!.width).toBeGreaterThan(panelBox!.width + 50);

    const stored = await page.evaluate(() => localStorage.getItem('pixelator:layersPanelWidth'));
    expect(Number(stored)).toBeGreaterThan(272);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Drag resize handle right narrows the panel and persists width', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    const panel = page.getByLabel('Layers', { exact: true });
    const handle = page.getByTestId('layers-panel-resize');

    const panelBox = await panel.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(handleBox).not.toBeNull();

    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    // Move 40px right → dx = -40 → new width ≈ 272 - 40 = 232
    const endX = startX + 40;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 6, startY); // cross the 4px activation threshold
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    const newPanelBox = await panel.boundingBox();
    expect(newPanelBox!.width).toBeLessThan(panelBox!.width - 20);

    const stored = await page.evaluate(() => localStorage.getItem('pixelator:layersPanelWidth'));
    expect(Number(stored)).toBeLessThan(272);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Persisted panel width is restored on reload', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const TARGET_WIDTH = 350;
    await page.addInitScript((w) => {
      localStorage.setItem('pixelator:layersPanelWidth', String(w));
    }, TARGET_WIDTH);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    const panelBox = await page.getByLabel('Layers', { exact: true }).boundingBox();
    expect(panelBox!.width).toBeGreaterThanOrEqual(TARGET_WIDTH - 2);
    expect(panelBox!.width).toBeLessThanOrEqual(TARGET_WIDTH + 2);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Delete layer removes it from storage', async ({ page }) => {
    const errors = captureConsoleErrors(page);

    const SEED = {
      schemaVersion: 2,
      drawings: [
        {
          id: 'test-layers-del-1',
          name: 'Delete layer test',
          width: 4,
          height: 4,
          layers: [
            {
              id: 'layer-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              pixels: EMPTY_4X4_PIXELS,
            },
            {
              id: 'layer-2',
              name: 'Foreground',
              visible: true,
              opacity: 1,
              pixels: EMPTY_4X4_PIXELS,
            },
          ],
          activeLayerId: 'layer-2',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      currentDrawingId: 'test-layers-del-1',
    };

    await page.addInitScript((seed) => {
      localStorage.setItem('pixelator.store', JSON.stringify(seed));
      localStorage.setItem('pixelator.seeded', '9999');
    }, SEED);

    await page.goto('/');
    await expect(page.getByTestId('editor-canvas')).toBeVisible();

    // Open the layer actions overflow menu for the top layer (use .first()).
    await page.getByRole('button', { name: 'Layer actions' }).first().click();

    // Click Delete in the menu — no confirm dialog, deletion is instant.
    await page.getByTestId('layer-menu-delete').click();

    // Wait for the drawing to have only 1 layer.
    await expect.poll(async () => {
      const store = await readStore(page);
      const d = store.drawings.find((x) => x.id === 'test-layers-del-1');
      return d?.layers.length ?? null;
    }, { timeout: 2000 }).toBe(1);

    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
