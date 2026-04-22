/**
 * Tests for `SymmetryPicker` — popover menu with three symmetry modes.
 * Covers item rendering, selected state (aria-checked on menuitemradio),
 * and onPick callback.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SymmetryPicker from './SymmetryPicker';

describe('SymmetryPicker', () => {
  it('renders three items: Vertical, Horizontal, 4-way', () => {
    render(<SymmetryPicker symmetryMode="vertical" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Vertical/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Horizontal/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /4-way/i })).toBeInTheDocument();
  });

  it('marks the item matching symmetryMode as checked (vertical)', () => {
    render(<SymmetryPicker symmetryMode="vertical" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Vertical/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Horizontal/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /4-way/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the item matching symmetryMode as checked (horizontal)', () => {
    render(<SymmetryPicker symmetryMode="horizontal" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Vertical/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /Horizontal/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /4-way/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the item matching symmetryMode as checked (both)', () => {
    render(<SymmetryPicker symmetryMode="both" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Vertical/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /Horizontal/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /4-way/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onPick with "vertical" when Vertical is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<SymmetryPicker symmetryMode="horizontal" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Vertical/i }));
    expect(onPick).toHaveBeenCalledWith('vertical');
  });

  it('calls onPick with "horizontal" when Horizontal is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<SymmetryPicker symmetryMode="vertical" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Horizontal/i }));
    expect(onPick).toHaveBeenCalledWith('horizontal');
  });

  it('calls onPick with "both" when 4-way is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<SymmetryPicker symmetryMode="vertical" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /4-way/i }));
    expect(onPick).toHaveBeenCalledWith('both');
  });
});
