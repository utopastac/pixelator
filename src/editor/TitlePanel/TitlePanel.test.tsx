/**
 * Tests for `TitlePanel` — top-center floating panel with an editable drawing
 * title, undo/redo buttons, optional canvas-size picker, and optional zoom
 * controls.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// TitlePanel > ZoomControls > Popover uses ResizeObserver — shim it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

import TitlePanel from './TitlePanel';
import type { TitlePanelProps } from './TitlePanel';

function makeProps(overrides: Partial<TitlePanelProps> = {}): TitlePanelProps {
  return {
    title: 'My Drawing',
    onTitleChange: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    ...overrides,
  };
}

describe('TitlePanel', () => {
  it('renders the title text', () => {
    render(<TitlePanel {...makeProps({ title: 'Pixel Art' })} />);
    // EditableText renders a span with the value text in display mode.
    expect(screen.getByText('Pixel Art')).toBeInTheDocument();
  });

  it('renders an Undo button', () => {
    render(<TitlePanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('renders a Redo button', () => {
    render(<TitlePanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
  });

  it('Undo button is disabled when canUndo is false', () => {
    render(<TitlePanel {...makeProps({ canUndo: false })} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('Redo button is disabled when canRedo is false', () => {
    render(<TitlePanel {...makeProps({ canRedo: false })} />);
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('Undo button is enabled when canUndo is true', () => {
    render(<TitlePanel {...makeProps({ canUndo: true })} />);
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('Redo button is enabled when canRedo is true', () => {
    render(<TitlePanel {...makeProps({ canRedo: true })} />);
    expect(screen.getByRole('button', { name: 'Redo' })).not.toBeDisabled();
  });

  it('clicking Undo calls onUndo', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<TitlePanel {...makeProps({ canUndo: true, onUndo })} />);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('clicking Redo calls onRedo', async () => {
    const user = userEvent.setup();
    const onRedo = vi.fn();
    render(<TitlePanel {...makeProps({ canRedo: true, onRedo })} />);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('editing the title calls onTitleChange with the new value', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    render(<TitlePanel {...makeProps({ title: 'Old Name', onTitleChange })} />);
    // EditableText receives ariaLabel="Drawing name", so the span's role=button
    // has aria-label="Drawing name", not the value text.
    const titleSpan = screen.getByRole('button', { name: 'Drawing name' });
    await user.dblClick(titleSpan);
    // After double-click the input also has aria-label="Drawing name".
    const input = await screen.findByRole('textbox', { name: 'Drawing name' });
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.keyboard('{Enter}');
    expect(onTitleChange).toHaveBeenCalledWith('New Name');
  });

  it('does not render zoom controls when viewport prop is absent', () => {
    render(<TitlePanel {...makeProps()} />);
    // ZoomControls renders a group with aria-label "Zoom controls"
    expect(screen.queryByRole('group', { name: 'Zoom controls' })).not.toBeInTheDocument();
  });

  it('renders zoom controls when a viewport prop is provided', () => {
    const viewport = {
      zoom: 1,
      setZoom: vi.fn(),
      fit: vi.fn(),
      isAutoFit: false,
    };
    render(<TitlePanel {...makeProps({ viewport })} />);
    expect(screen.getByRole('group', { name: 'Zoom controls' })).toBeInTheDocument();
  });

  it('does not render the canvas size picker when sizes prop is absent', () => {
    render(<TitlePanel {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /canvas size/i })).not.toBeInTheDocument();
  });

  it('renders the canvas size picker when sizes prop is provided', () => {
    render(<TitlePanel {...makeProps({ sizes: [8, 16, 32], currentWidth: 16, currentHeight: 16 })} />);
    expect(screen.getByRole('button', { name: /canvas size/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Symmetry picker
// ---------------------------------------------------------------------------

describe('symmetry picker', () => {
  it('does not render the symmetry button without setSymmetryMode', () => {
    render(<TitlePanel {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Symmetry' })).not.toBeInTheDocument();
  });

  it('renders the symmetry button when setSymmetryMode is provided', () => {
    render(<TitlePanel {...makeProps({ symmetryMode: 'none', setSymmetryMode: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Symmetry' })).toBeInTheDocument();
  });

  it('clicking symmetry opens the symmetry picker popover', async () => {
    const user = userEvent.setup();
    render(<TitlePanel {...makeProps({ symmetryMode: 'none', setSymmetryMode: vi.fn() })} />);
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    expect(screen.getByRole('menu', { name: 'Symmetry mode' })).toBeInTheDocument();
  });

  it('picking vertical symmetry calls setSymmetryMode("vertical")', async () => {
    const user = userEvent.setup();
    const setSymmetryMode = vi.fn();
    render(<TitlePanel {...makeProps({ symmetryMode: 'none', setSymmetryMode })} />);
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    await user.click(screen.getByRole('menuitemradio', { name: /vertical/i }));
    expect(setSymmetryMode).toHaveBeenCalledWith('vertical');
  });

  it('picking none closes the popover', async () => {
    const user = userEvent.setup();
    render(<TitlePanel {...makeProps({ symmetryMode: 'vertical', setSymmetryMode: vi.fn() })} />);
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    await user.click(screen.getByRole('menuitemradio', { name: /none/i }));
    expect(screen.queryByRole('menu', { name: 'Symmetry mode' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tiling toggle
// ---------------------------------------------------------------------------

describe('tiling toggle', () => {
  it('does not render tiling button without setTilingEnabled', () => {
    render(<TitlePanel {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Tiling preview' })).not.toBeInTheDocument();
  });

  it('renders tiling button when setTilingEnabled is provided', () => {
    render(<TitlePanel {...makeProps({ tilingEnabled: false, setTilingEnabled: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Tiling preview' })).toBeInTheDocument();
  });

  it('clicking tiling when off calls setTilingEnabled(true)', async () => {
    const user = userEvent.setup();
    const setTilingEnabled = vi.fn();
    render(<TitlePanel {...makeProps({ tilingEnabled: false, setTilingEnabled })} />);
    await user.click(screen.getByRole('button', { name: 'Tiling preview' }));
    expect(setTilingEnabled).toHaveBeenCalledWith(true);
  });

  it('clicking tiling when on calls setTilingEnabled(false)', async () => {
    const user = userEvent.setup();
    const setTilingEnabled = vi.fn();
    render(<TitlePanel {...makeProps({ tilingEnabled: true, setTilingEnabled })} />);
    await user.click(screen.getByRole('button', { name: 'Tiling preview' }));
    expect(setTilingEnabled).toHaveBeenCalledWith(false);
  });
});
