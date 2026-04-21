/**
 * Tests for `ZoomControls` — minus button, percentage readout, plus button,
 * and the Fit option inside the zoom preset popover.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ZoomControls uses Popover which needs ResizeObserver — shim it before import.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

import ZoomControls from './ZoomControls';
import type { ZoomControlsProps } from './ZoomControls';

function makeViewport(overrides: Partial<ZoomControlsProps['viewport']> = {}): ZoomControlsProps['viewport'] {
  return {
    zoom: 1,
    setZoom: vi.fn(),
    fit: vi.fn(),
    isAutoFit: false,
    ...overrides,
  };
}

describe('ZoomControls', () => {
  it('renders the current zoom level as a percentage', () => {
    render(<ZoomControls viewport={makeViewport({ zoom: 2 })} />);
    expect(screen.getByRole('button', { name: /Zoom: 200%/ })).toBeInTheDocument();
  });

  it('renders 100% for zoom=1', () => {
    render(<ZoomControls viewport={makeViewport({ zoom: 1 })} />);
    expect(screen.getByRole('button', { name: /Zoom: 100%/ })).toBeInTheDocument();
  });

  it('clicking the + button calls setZoom with doubled value', async () => {
    const user = userEvent.setup();
    const setZoom = vi.fn();
    render(<ZoomControls viewport={makeViewport({ zoom: 2, setZoom })} />);
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(setZoom).toHaveBeenCalledWith(4);
  });

  it('clicking the - button calls setZoom with halved value', async () => {
    const user = userEvent.setup();
    const setZoom = vi.fn();
    render(<ZoomControls viewport={makeViewport({ zoom: 4, setZoom })} />);
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(setZoom).toHaveBeenCalledWith(2);
  });

  it('- button is disabled at minimum zoom (1)', () => {
    render(<ZoomControls viewport={makeViewport({ zoom: 1 })} />);
    const btn = screen.getByRole('button', { name: 'Zoom out' });
    expect(btn).toBeDisabled();
  });

  it('+ button is disabled at maximum zoom (64)', () => {
    render(<ZoomControls viewport={makeViewport({ zoom: 64 })} />);
    const btn = screen.getByRole('button', { name: 'Zoom in' });
    expect(btn).toBeDisabled();
  });

  it('clicking the zoom level readout opens the preset popover', async () => {
    const user = userEvent.setup();
    render(<ZoomControls viewport={makeViewport({ zoom: 1 })} />);
    await user.click(screen.getByRole('button', { name: /Zoom: 100%/ }));
    expect(screen.getByRole('menu', { name: 'Zoom presets' })).toBeInTheDocument();
  });

  it('clicking the Fit option in the popover calls fit()', async () => {
    const user = userEvent.setup();
    const fit = vi.fn();
    render(<ZoomControls viewport={makeViewport({ zoom: 1, fit })} />);
    // Open the popover first
    await user.click(screen.getByRole('button', { name: /Zoom: 100%/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Fit' }));
    expect(fit).toHaveBeenCalledTimes(1);
  });

  it('clicking a preset in the popover calls setZoom with that value', async () => {
    const user = userEvent.setup();
    const setZoom = vi.fn();
    render(<ZoomControls viewport={makeViewport({ zoom: 1, setZoom })} />);
    await user.click(screen.getByRole('button', { name: /Zoom: 100%/ }));
    await user.click(screen.getByRole('menuitemradio', { name: '400%' }));
    expect(setZoom).toHaveBeenCalledWith(4);
  });
});
