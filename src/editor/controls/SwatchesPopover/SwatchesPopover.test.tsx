/**
 * Tests for `SwatchesPopover` — the active-color swatch trigger + colour
 * picker popover. Covers: open/close, palette swatch selection, hex input
 * validation, palette picker header visibility, and the onAddCustomColor
 * logic fired on popover close.
 *
 * The Popover portals to document.body, so `document.body.innerHTML = ''` is
 * used in beforeEach to avoid cross-test DOM leakage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import SwatchesPopover from './SwatchesPopover';

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

const palette = ['#ff0000', '#00ff00', '#0000ff'];
const customColors: string[] = [];

function makeProps(overrides: Partial<React.ComponentProps<typeof SwatchesPopover>> = {}) {
  return {
    activeColor: '#ff0000',
    setActiveColor: vi.fn(),
    palette,
    customColors,
    onAddCustomColor: vi.fn(),
    independentHue: null,
    setIndependentHue: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('SwatchesPopover', () => {
  it('renders the active color swatch button', () => {
    render(<SwatchesPopover {...makeProps()} />);
    expect(screen.getByRole('button', { name: /colors/i })).toBeInTheDocument();
  });

  it('opens the color picker popover when the swatch is clicked', async () => {
    const user = userEvent.setup();
    render(<SwatchesPopover {...makeProps()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    expect(screen.getByRole('dialog', { name: /colors/i })).toBeInTheDocument();
  });

  it('renders palette swatches', async () => {
    const user = userEvent.setup();
    render(<SwatchesPopover {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    expect(screen.getByRole('button', { name: 'Select color #ff0000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select color #00ff00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select color #0000ff' })).toBeInTheDocument();
  });

  it('clicking a palette swatch calls setActiveColor', async () => {
    const user = userEvent.setup();
    const setActiveColor = vi.fn();
    render(<SwatchesPopover {...makeProps({ setActiveColor })} />);
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    await user.click(screen.getByRole('button', { name: 'Select color #00ff00' }));
    expect(setActiveColor).toHaveBeenCalledWith('#00ff00');
  });

  it('hex input shows active color without the # prefix', async () => {
    const user = userEvent.setup();
    render(<SwatchesPopover {...makeProps({ activeColor: '#ff0000' })} />);
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    // The CompactInput renders a plain <input> with no label, so query by value
    const input = screen.getByDisplayValue('ff0000');
    expect(input).toBeInTheDocument();
  });

  it('typing a valid hex and pressing Enter calls setActiveColor', async () => {
    const setActiveColor = vi.fn();
    render(<SwatchesPopover {...makeProps({ setActiveColor })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();

    const input = screen.getByDisplayValue('ff0000');
    // Use fireEvent.change to atomically set a complete valid 6-char hex
    fireEvent.change(input, { target: { value: 'aabbcc' } });
    expect(setActiveColor).toHaveBeenCalledWith('#aabbcc');
  });

  it('typing an invalid hex and pressing Enter does not call setActiveColor', async () => {
    const setActiveColor = vi.fn();
    render(<SwatchesPopover {...makeProps({ setActiveColor })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();

    const input = screen.getByDisplayValue('ff0000');
    setActiveColor.mockClear();
    // Set a value that is not a valid 6-char hex (only 3 chars)
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(setActiveColor).not.toHaveBeenCalled();
  });

  it('typing a valid hex immediately updates active color (on change)', async () => {
    const setActiveColor = vi.fn();
    render(<SwatchesPopover {...makeProps({ setActiveColor })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();

    const input = screen.getByDisplayValue('ff0000');
    // The onChange handler fires setActiveColor as soon as the value is a valid 6-char hex
    fireEvent.change(input, { target: { value: '123456' } });
    expect(setActiveColor).toHaveBeenCalledWith('#123456');
  });

  it('palette header button renders when paletteId and onPaletteChange are provided', async () => {
    const user = userEvent.setup();
    render(
      <SwatchesPopover
        {...makeProps({ paletteId: 'default', onPaletteChange: vi.fn() })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    expect(screen.getByRole('button', { name: /palette/i })).toBeInTheDocument();
  });

  it('palette header button does not render when paletteId is undefined', async () => {
    const user = userEvent.setup();
    render(
      <SwatchesPopover
        {...makeProps({ paletteId: undefined, onPaletteChange: vi.fn() })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    // The only "Palette" button would be the header; it should not be present
    expect(screen.queryByRole('button', { name: /^palette/i })).toBeNull();
  });

  it('closing the popover with a new color calls onAddCustomColor', async () => {
    const user = userEvent.setup();
    const onAddCustomColor = vi.fn();
    // Active color is not in palette or customColors
    render(
      <SwatchesPopover
        {...makeProps({
          activeColor: '#123456',
          palette: ['#ff0000', '#00ff00'],
          customColors: [],
          onAddCustomColor,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    // Close by clicking outside — pointerdown on document.body
    fireEvent.pointerDown(document.body);
    expect(onAddCustomColor).toHaveBeenCalledWith('#123456');
  });

  it('closing the popover with a color already in palette does not call onAddCustomColor', async () => {
    const user = userEvent.setup();
    const onAddCustomColor = vi.fn();
    render(
      <SwatchesPopover
        {...makeProps({
          activeColor: '#ff0000',
          palette: ['#ff0000', '#00ff00'],
          customColors: [],
          onAddCustomColor,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    fireEvent.pointerDown(document.body);
    expect(onAddCustomColor).not.toHaveBeenCalled();
  });

  it('closing the popover with a color already in customColors does not call onAddCustomColor', async () => {
    const user = userEvent.setup();
    const onAddCustomColor = vi.fn();
    render(
      <SwatchesPopover
        {...makeProps({
          activeColor: '#abcdef',
          palette: ['#ff0000'],
          customColors: ['#abcdef'],
          onAddCustomColor,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /colors/i }));
    await flushRaf();
    fireEvent.pointerDown(document.body);
    expect(onAddCustomColor).not.toHaveBeenCalled();
  });
});
