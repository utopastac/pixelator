/**
 * Tests for `DownloadMenu` — the popover body that lists download format
 * options (SVG, PNG scales, all-layers SVG, and optional Pixelator export).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadMenu from './DownloadMenu';
import type { DownloadMenuProps } from './DownloadMenu';

function makeProps(overrides: Partial<DownloadMenuProps> = {}): DownloadMenuProps {
  return {
    onDownloadSvg: vi.fn(),
    onDownloadPng: vi.fn(),
    onDownloadLayersSvg: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('DownloadMenu', () => {
  it('renders without crashing', () => {
    const { container } = render(<DownloadMenu {...makeProps()} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders a "Download SVG" option', () => {
    render(<DownloadMenu {...makeProps()} />);
    expect(screen.getByRole('menuitem', { name: 'Download SVG' })).toBeInTheDocument();
  });

  it('renders a "Download all layers (SVG)" option', () => {
    render(<DownloadMenu {...makeProps()} />);
    expect(screen.getByRole('menuitem', { name: 'Download all layers (SVG)' })).toBeInTheDocument();
  });

  it('renders PNG scale chips', () => {
    render(<DownloadMenu {...makeProps()} />);
    // PngScalePicker renders chips for each scale; at minimum 1× should be present.
    expect(screen.getByRole('button', { name: /Download PNG at 1×/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download PNG at 2×/ })).toBeInTheDocument();
  });

  it('does not render "Export Pixelator file" when onDownloadPixelator is not provided', () => {
    render(<DownloadMenu {...makeProps()} />);
    expect(screen.queryByRole('menuitem', { name: 'Export Pixelator file' })).not.toBeInTheDocument();
  });

  it('renders "Export Pixelator file" when onDownloadPixelator is provided', () => {
    render(<DownloadMenu {...makeProps({ onDownloadPixelator: vi.fn() })} />);
    expect(screen.getByRole('menuitem', { name: 'Export Pixelator file' })).toBeInTheDocument();
  });

  it('clicking "Download SVG" calls onClose then onDownloadSvg', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDownloadSvg = vi.fn();
    render(<DownloadMenu {...makeProps({ onClose, onDownloadSvg })} />);
    await user.click(screen.getByRole('menuitem', { name: 'Download SVG' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownloadSvg).toHaveBeenCalledTimes(1);
  });

  it('clicking "Download all layers (SVG)" calls onClose then onDownloadLayersSvg', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDownloadLayersSvg = vi.fn();
    render(<DownloadMenu {...makeProps({ onClose, onDownloadLayersSvg })} />);
    await user.click(screen.getByRole('menuitem', { name: 'Download all layers (SVG)' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownloadLayersSvg).toHaveBeenCalledTimes(1);
  });

  it('clicking a PNG scale chip calls onClose and onDownloadPng with the correct scale', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDownloadPng = vi.fn();
    render(<DownloadMenu {...makeProps({ onClose, onDownloadPng })} />);
    await user.click(screen.getByRole('button', { name: /Download PNG at 4×/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownloadPng).toHaveBeenCalledWith(4);
  });

  it('clicking "Export Pixelator file" calls onClose and onDownloadPixelator', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDownloadPixelator = vi.fn();
    render(<DownloadMenu {...makeProps({ onClose, onDownloadPixelator })} />);
    await user.click(screen.getByRole('menuitem', { name: 'Export Pixelator file' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDownloadPixelator).toHaveBeenCalledTimes(1);
  });

  it('includes dimension readout on PNG chip labels when width and height are supplied', () => {
    render(<DownloadMenu {...makeProps({ width: 16, height: 16 })} />);
    expect(
      screen.getByRole('button', { name: 'Download PNG at 2× (32 × 32 px)' }),
    ).toBeInTheDocument();
  });
});
