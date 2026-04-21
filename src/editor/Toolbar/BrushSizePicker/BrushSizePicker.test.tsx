/**
 * Tests for `BrushSizePicker` — popover menu with three brush sizes.
 * Covers item rendering, selected state (aria-checked on menuitemradio),
 * and onPick callback.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrushSizePicker from './BrushSizePicker';

describe('BrushSizePicker', () => {
  it('renders four items: Small, Medium, Large, Extra Large', () => {
    render(<BrushSizePicker brushSize="sm" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: 'Small' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Large' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Extra Large' })).toBeInTheDocument();
  });

  it('marks the item matching brushSize as checked', () => {
    render(<BrushSizePicker brushSize="md" onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: 'Small' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Large' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'Extra Large' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onPick with "sm" when Small is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<BrushSizePicker brushSize="md" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: 'Small' }));
    expect(onPick).toHaveBeenCalledWith('sm');
  });

  it('calls onPick with "md" when Medium is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<BrushSizePicker brushSize="sm" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: 'Medium' }));
    expect(onPick).toHaveBeenCalledWith('md');
  });

  it('calls onPick with "lg" when Large is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<BrushSizePicker brushSize="sm" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: 'Large' }));
    expect(onPick).toHaveBeenCalledWith('lg');
  });

  it('calls onPick with "xl" when Extra Large is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<BrushSizePicker brushSize="sm" onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: 'Extra Large' }));
    expect(onPick).toHaveBeenCalledWith('xl');
  });
});
