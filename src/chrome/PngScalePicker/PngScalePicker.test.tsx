/**
 * Tests for `PngScalePicker` — chip-row picker used in the export menu.
 * It's a pure presentational controlled component: default scales,
 * custom `scales` override, size-annotated labels, and `onPick` fires the
 * selected scale.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PngScalePicker from './PngScalePicker';

describe('PngScalePicker', () => {
  it('renders default scale chips [1, 2, 4, 8, 16]', () => {
    render(<PngScalePicker onPick={() => {}} />);
    for (const s of [1, 2, 4, 8, 16]) {
      expect(screen.getByRole('button', { name: new RegExp(`Download PNG at ${s}×`) })).toBeInTheDocument();
    }
  });

  it('respects a custom `scales` array', () => {
    render(<PngScalePicker scales={[1, 3]} onPick={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Download PNG at 1×/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download PNG at 3×/ })).toBeInTheDocument();
  });

  it('includes the output pixel dimensions in the chip aria-label when width+height are supplied', () => {
    render(<PngScalePicker scales={[2]} width={16} height={10} onPick={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Download PNG at 2× (32 × 20 px)' }),
    ).toBeInTheDocument();
  });

  it('fires onPick with the selected scale', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<PngScalePicker scales={[1, 4]} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /Download PNG at 4×/ }));
    expect(onPick).toHaveBeenCalledWith(4);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('exposes the chip group with an accessible label', () => {
    render(<PngScalePicker onPick={() => {}} />);
    expect(screen.getByRole('group', { name: 'PNG export scale' })).toBeInTheDocument();
  });
});
