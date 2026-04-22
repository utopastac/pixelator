/**
 * Tests for `MarqueePicker` — popover menu with three selection shapes.
 * Covers item rendering, selected state (aria-checked on menuitemradio),
 * and onPick callback.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarqueePicker from './MarqueePicker';

describe('MarqueePicker', () => {
  it('renders three items: Rectangular, Elliptical, Magic wand', () => {
    render(<MarqueePicker marqueeShape="rect" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Rectangular/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Elliptical/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Magic wand/i })).toBeInTheDocument();
  });

  it('marks the item matching marqueeShape as checked', () => {
    render(<MarqueePicker marqueeShape="ellipse" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Rectangular/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /Elliptical/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Magic wand/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onPick with "rect" when Rectangular is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<MarqueePicker marqueeShape="ellipse" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Rectangular/i }));
    expect(onPick).toHaveBeenCalledWith('rect');
  });

  it('calls onPick with "ellipse" when Elliptical is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<MarqueePicker marqueeShape="rect" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Elliptical/i }));
    expect(onPick).toHaveBeenCalledWith('ellipse');
  });

  it('calls onPick with "wand" when Magic wand is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<MarqueePicker marqueeShape="rect" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Magic wand/i }));
    expect(onPick).toHaveBeenCalledWith('wand');
  });
});
