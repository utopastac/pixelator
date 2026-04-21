/**
 * Tests for `CanvasSizePicker` — the canvas-size readout button + preset/custom
 * size popover. Covers: open/close, preset selection, custom W/H inputs with
 * Enter-to-apply, clamping, non-numeric guard, and the checkmark indicator.
 *
 * The Popover portals to document.body, so `document.body.innerHTML = ''` is
 * used in beforeEach to avoid cross-test DOM leakage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import CanvasSizePicker from './CanvasSizePicker';

// jsdom lacks ResizeObserver — stub it globally so Popover doesn't throw.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// The Popover uses double-rAF before focusing / positioning.
async function flushRaf() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

const defaultSizes = [8, 16, 32, 64];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('CanvasSizePicker', () => {
  it('renders the size button', () => {
    render(
      <CanvasSizePicker sizes={defaultSizes} currentWidth={32} currentHeight={32} />,
    );
    expect(
      screen.getByRole('button', { name: /canvas size/i }),
    ).toBeInTheDocument();
  });

  it('opens the popover when the button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CanvasSizePicker sizes={defaultSizes} currentWidth={32} currentHeight={32} />,
    );
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();
    expect(screen.getByRole('menu', { name: /canvas size/i })).toBeInTheDocument();
  });

  it('renders preset size buttons when open', async () => {
    const user = userEvent.setup();
    render(
      <CanvasSizePicker sizes={defaultSizes} currentWidth={32} currentHeight={32} />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();
    // Use data-testid selectors that CanvasSizePicker forwards via PopoverMenuItem
    for (const s of defaultSizes) {
      expect(screen.getByTestId(`size-preset-${s}`)).toBeInTheDocument();
    }
  });

  it('clicking a preset calls onPickSize with correct dimensions', async () => {
    const user = userEvent.setup();
    const onPickSize = vi.fn();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={onPickSize}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();
    await user.click(screen.getByTestId('size-preset-16'));
    expect(onPickSize).toHaveBeenCalledWith(16, 16);
  });

  it('clicking a preset closes the popover', async () => {
    const user = userEvent.setup();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();
    await user.click(screen.getByTestId('size-preset-16'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('custom width and height inputs are rendered', async () => {
    const user = userEvent.setup();
    render(
      <CanvasSizePicker sizes={defaultSizes} currentWidth={32} currentHeight={32} />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();
    const inputs = screen.getAllByRole('textbox');
    // Two CompactInput text fields for W and H
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('pressing Enter in the width input applies the custom size', async () => {
    const user = userEvent.setup();
    const onPickSize = vi.fn();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={onPickSize}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();

    const [widthInput] = screen.getAllByRole('textbox');
    await user.clear(widthInput);
    await user.type(widthInput, '48');
    // The custom row is the last menuitemradio — preset rows come first
    const menuItemRadios = screen.getAllByRole('menuitemradio');
    const customRow = menuItemRadios[menuItemRadios.length - 1];
    fireEvent.keyDown(customRow, { key: 'Enter' });
    expect(onPickSize).toHaveBeenCalledWith(48, 32);
  });

  it('pressing Enter in the height input applies the custom size', async () => {
    const user = userEvent.setup();
    const onPickSize = vi.fn();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={onPickSize}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();

    const [, heightInput] = screen.getAllByRole('textbox');
    await user.clear(heightInput);
    await user.type(heightInput, '48');
    // The custom row is the last menuitemradio — preset rows come first
    const menuItemRadios = screen.getAllByRole('menuitemradio');
    const customRow = menuItemRadios[menuItemRadios.length - 1];
    fireEvent.keyDown(customRow, { key: 'Enter' });
    expect(onPickSize).toHaveBeenCalledWith(32, 48);
  });

  it('custom size values are clamped to minimum 4', async () => {
    const user = userEvent.setup();
    const onPickSize = vi.fn();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={onPickSize}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();

    const [widthInput, heightInput] = screen.getAllByRole('textbox');
    await user.clear(widthInput);
    await user.type(widthInput, '1');
    await user.clear(heightInput);
    await user.type(heightInput, '1');

    await user.click(screen.getByTestId('size-apply-custom'));
    expect(onPickSize).toHaveBeenCalledWith(4, 4);
  });

  it('custom size values are clamped to maximum 256', async () => {
    const user = userEvent.setup();
    const onPickSize = vi.fn();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={onPickSize}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();

    const [widthInput, heightInput] = screen.getAllByRole('textbox');
    await user.clear(widthInput);
    await user.type(widthInput, '999');
    await user.clear(heightInput);
    await user.type(heightInput, '999');

    await user.click(screen.getByTestId('size-apply-custom'));
    expect(onPickSize).toHaveBeenCalledWith(256, 256);
  });

  it('non-numeric input in custom fields does not call onPickSize', async () => {
    const user = userEvent.setup();
    const onPickSize = vi.fn();
    render(
      <CanvasSizePicker
        sizes={defaultSizes}
        currentWidth={32}
        currentHeight={32}
        onPickSize={onPickSize}
      />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();

    const [widthInput] = screen.getAllByRole('textbox');
    await user.clear(widthInput);
    await user.type(widthInput, 'abc');

    await user.click(screen.getByTestId('size-apply-custom'));
    expect(onPickSize).not.toHaveBeenCalled();
  });

  it('checkmark appears next to the matching preset when currentWidth/currentHeight match', async () => {
    const user = userEvent.setup();
    render(
      <CanvasSizePicker sizes={defaultSizes} currentWidth={16} currentHeight={16} />,
    );
    await user.click(screen.getByRole('button', { name: /canvas size/i }));
    await flushRaf();

    const selectedItem = screen.getByTestId('size-preset-16');
    // PopoverMenuItem renders role="menuitemradio" with aria-checked="true" when selected
    expect(selectedItem).toHaveAttribute('aria-checked', 'true');

    // The non-matching preset should not be checked
    const otherItem = screen.getByTestId('size-preset-32');
    expect(otherItem).toHaveAttribute('aria-checked', 'false');
  });
});
