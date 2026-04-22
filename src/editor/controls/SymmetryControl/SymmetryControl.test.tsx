import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SymmetryControl from './SymmetryControl';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

describe('SymmetryControl', () => {
  it('desktop: single trigger opens symmetry menu', async () => {
    const user = userEvent.setup();
    const setSymmetryMode = vi.fn();
    render(<SymmetryControl symmetryMode="none" setSymmetryMode={setSymmetryMode} />);
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    expect(screen.getByRole('menu', { name: 'Symmetry mode' })).toBeInTheDocument();
  });

  it('mobile: renders three inline toggles and no Symmetry menu trigger', () => {
    const setSymmetryMode = vi.fn();
    render(<SymmetryControl symmetryMode="none" setSymmetryMode={setSymmetryMode} mobile />);
    expect(screen.queryByRole('button', { name: 'Symmetry' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Symmetry mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vertical mirroring' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Horizontal mirroring' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Four-way mirroring' })).toBeInTheDocument();
  });

  it('mobile: activates vertical mode from none', async () => {
    const user = userEvent.setup();
    const setSymmetryMode = vi.fn();
    render(<SymmetryControl symmetryMode="none" setSymmetryMode={setSymmetryMode} mobile />);
    await user.click(screen.getByRole('button', { name: 'Vertical mirroring' }));
    expect(setSymmetryMode).toHaveBeenCalledWith('vertical');
  });

  it('mobile: tapping active vertical clears to none', async () => {
    const user = userEvent.setup();
    const setSymmetryMode = vi.fn();
    render(<SymmetryControl symmetryMode="vertical" setSymmetryMode={setSymmetryMode} mobile />);
    await user.click(screen.getByRole('button', { name: 'Vertical mirroring' }));
    expect(setSymmetryMode).toHaveBeenCalledWith('none');
  });

  it('mobile: switching from vertical to horizontal', async () => {
    const user = userEvent.setup();
    const setSymmetryMode = vi.fn();
    render(<SymmetryControl symmetryMode="vertical" setSymmetryMode={setSymmetryMode} mobile />);
    await user.click(screen.getByRole('button', { name: 'Horizontal mirroring' }));
    expect(setSymmetryMode).toHaveBeenCalledWith('horizontal');
  });
});
