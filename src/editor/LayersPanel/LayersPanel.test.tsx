/**
 * Tests for `LayersPanel` — the floating layer-stack panel.
 *
 * Covers: layer list rendering, active-layer indication, clicking a layer row
 * to set it active, add-layer button, visibility toggle, lock toggle, and
 * the delete action via the layer actions context menu.
 *
 * LayersPanel uses Thumbnail (compositeToSvg) and ContextMenu. Neither needs
 * mocking — compositeToSvg is pure and ContextMenu portals to document.body.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LayersPanel from './LayersPanel';
import type { LayersPanelProps } from './LayersPanel';
import type { Layer } from '@/lib/storage';
import layersStyles from './LayersPanel.module.css';
import floatingStyles from '@/primitives/FloatingPanel/FloatingPanel.module.css';

// ContextMenu and Popover rely on ResizeObserver — shim it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLayer(overrides: Partial<Layer> & { id: string; name: string }): Layer {
  return {
    visible: true,
    opacity: 1,
    pixels: [],
    locked: false,
    ...overrides,
  };
}

const LAYER_A = makeLayer({ id: 'a', name: 'Background' });
const LAYER_B = makeLayer({ id: 'b', name: 'Foreground' });

function makeProps(overrides: Partial<LayersPanelProps> = {}): LayersPanelProps {
  return {
    layers: [LAYER_A, LAYER_B],
    activeLayerId: 'b',
    width: 16,
    height: 16,
    onAddLayer: vi.fn(),
    onDuplicateLayer: vi.fn(),
    onDuplicateLayerTo: vi.fn(),
    onClearLayer: vi.fn(),
    onRotateLayer: vi.fn(),
    onDeleteLayer: vi.fn(),
    onRenameLayer: vi.fn(),
    onSetVisibility: vi.fn(),
    onSoloVisibility: vi.fn(),
    onSetLocked: vi.fn(),
    onSetOpacity: vi.fn(),
    onMoveLayer: vi.fn(),
    onMergeDown: vi.fn(),
    onExportLayerSvg: vi.fn(),
    onSetActive: vi.fn(),
    onDownloadSvg: vi.fn(),
    onDownloadPng: vi.fn(),
    onDownloadLayersSvg: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering basics
// ---------------------------------------------------------------------------

describe('LayersPanel — layer list', () => {
  it('applies mobile hook classes on the panel root when mobile is true', () => {
    render(<LayersPanel {...makeProps({ mobile: true })} />);
    const root = screen.getByLabelText('Layers');
    expect(root).toHaveClass(layersStyles.mobile);
    expect(root).toHaveClass(floatingStyles.mobile);
  });

  it('renders a row for each layer by name', () => {
    render(<LayersPanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Layer Background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Layer Foreground' })).toBeInTheDocument();
  });

  it('renders the list as a list element', () => {
    render(<LayersPanel {...makeProps()} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Active layer indication
// ---------------------------------------------------------------------------

describe('LayersPanel — active layer', () => {
  it('marks the active layer row with aria-pressed=true', () => {
    render(<LayersPanel {...makeProps({ activeLayerId: 'a' })} />);
    const activeRow = screen.getByRole('button', { name: 'Layer Background' });
    expect(activeRow).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the inactive layer row with aria-pressed=false', () => {
    render(<LayersPanel {...makeProps({ activeLayerId: 'a' })} />);
    const inactiveRow = screen.getByRole('button', { name: 'Layer Foreground' });
    expect(inactiveRow).toHaveAttribute('aria-pressed', 'false');
  });
});

// ---------------------------------------------------------------------------
// Clicking a layer row
// ---------------------------------------------------------------------------

describe('LayersPanel — selecting a layer', () => {
  it('clicking a layer row calls onSetActive with that layer id', async () => {
    const user = userEvent.setup();
    const onSetActive = vi.fn();
    render(<LayersPanel {...makeProps({ onSetActive })} />);
    await user.click(screen.getByRole('button', { name: 'Layer Background' }));
    expect(onSetActive).toHaveBeenCalledWith('a');
  });
});

// ---------------------------------------------------------------------------
// Add layer button
// ---------------------------------------------------------------------------

describe('LayersPanel — add layer', () => {
  it('clicking the Add layer button calls onAddLayer', async () => {
    const user = userEvent.setup();
    const onAddLayer = vi.fn();
    render(<LayersPanel {...makeProps({ onAddLayer })} />);
    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    expect(onAddLayer).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Visibility toggle
// ---------------------------------------------------------------------------

describe('LayersPanel — visibility toggle', () => {
  it('clicking the visibility button for a visible layer calls onSetVisibility with false', async () => {
    const user = userEvent.setup();
    const onSetVisibility = vi.fn();
    render(<LayersPanel {...makeProps({ onSetVisibility })} />);
    // Both layers are visible; click Background's eye button.
    const [eyeBtn] = screen.getAllByRole('button', { name: 'Hide layer' });
    await user.click(eyeBtn);
    expect(onSetVisibility).toHaveBeenCalledWith(expect.any(String), false);
  });

  it('clicking the visibility button for a hidden layer calls onSetVisibility with true', async () => {
    const user = userEvent.setup();
    const onSetVisibility = vi.fn();
    const hiddenLayer = makeLayer({ id: 'a', name: 'Background', visible: false });
    render(
      <LayersPanel
        {...makeProps({ layers: [hiddenLayer, LAYER_B], onSetVisibility })}
      />,
    );
    const showBtn = screen.getByRole('button', { name: 'Show layer' });
    await user.click(showBtn);
    expect(onSetVisibility).toHaveBeenCalledWith('a', true);
  });
});

// ---------------------------------------------------------------------------
// Lock toggle
// ---------------------------------------------------------------------------

describe('LayersPanel — lock toggle', () => {
  it('clicking the lock button for an unlocked layer calls onSetLocked with true', async () => {
    const user = userEvent.setup();
    const onSetLocked = vi.fn();
    render(<LayersPanel {...makeProps({ onSetLocked })} />);
    // Both layers are unlocked; grab the first "Lock layer" button.
    const [lockBtn] = screen.getAllByRole('button', { name: 'Lock layer' });
    await user.click(lockBtn);
    expect(onSetLocked).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('clicking the lock button for a locked layer calls onSetLocked with false', async () => {
    const user = userEvent.setup();
    const onSetLocked = vi.fn();
    const lockedLayer = makeLayer({ id: 'a', name: 'Background', locked: true });
    render(
      <LayersPanel
        {...makeProps({ layers: [lockedLayer, LAYER_B], onSetLocked })}
      />,
    );
    const unlockBtn = screen.getByRole('button', { name: 'Unlock layer' });
    await user.click(unlockBtn);
    expect(onSetLocked).toHaveBeenCalledWith('a', false);
  });
});

// ---------------------------------------------------------------------------
// Delete via the layer actions context menu
// ---------------------------------------------------------------------------

describe('LayersPanel — delete layer via actions menu', () => {
  it('opening layer actions menu and clicking Delete calls onDeleteLayer', async () => {
    const user = userEvent.setup();
    const onDeleteLayer = vi.fn();
    render(<LayersPanel {...makeProps({ onDeleteLayer })} />);
    // Open the actions menu for the first layer via the "Layer actions" button.
    const [actionsBtn] = screen.getAllByRole('button', { name: 'Layer actions' });
    await user.click(actionsBtn);
    // ContextMenu portals to document.body — find the Delete item.
    const deleteBtn = await screen.findByRole('menuitem', { name: 'Delete' });
    await user.click(deleteBtn);
    expect(onDeleteLayer).toHaveBeenCalledTimes(1);
  });
});
