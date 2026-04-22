/**
 * Tests for `ShapePicker` — popover menu with five shape tools.
 * Covers item rendering, selected state, fill-mode label variants,
 * and onPick callback.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShapePicker from './ShapePicker';
import type { ShapeType } from './ShapePicker';
import type { PixelArtFillMode } from '../../lib/pixelArtUtils';

const outlineModes: Record<ShapeType, PixelArtFillMode> = {
  rect: 'outline',
  circle: 'outline',
  triangle: 'outline',
  star: 'outline',
  arrow: 'outline',
};

const fillModes: Record<ShapeType, PixelArtFillMode> = {
  rect: 'fill',
  circle: 'fill',
  triangle: 'fill',
  star: 'fill',
  arrow: 'fill',
};

describe('ShapePicker', () => {
  it('renders five shape items', () => {
    render(<ShapePicker activeTool="rect" fillModes={outlineModes} onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Rectangle/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Circle/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Triangle/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Star/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Arrow/i })).toBeInTheDocument();
  });

  it('marks the item matching activeTool as checked', () => {
    render(<ShapePicker activeTool="circle" fillModes={outlineModes} onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: /Rectangle/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /Circle/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Triangle/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /Star/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /Arrow/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('shows "(outline)" suffix when fill mode is outline', () => {
    render(<ShapePicker activeTool="rect" fillModes={outlineModes} onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: 'Rectangle (outline)' })).toBeInTheDocument();
  });

  it('shows "(filled)" suffix when fill mode is fill', () => {
    render(<ShapePicker activeTool="rect" fillModes={fillModes} onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: 'Rectangle (filled)' })).toBeInTheDocument();
  });

  it('reflects per-shape fill modes independently', () => {
    const mixedModes: Record<ShapeType, PixelArtFillMode> = {
      rect: 'fill',
      circle: 'outline',
      triangle: 'fill',
      star: 'outline',
      arrow: 'fill',
    };
    render(<ShapePicker activeTool="rect" fillModes={mixedModes} onPick={() => {}} />);
    expect(screen.getByRole('menuitemradio', { name: 'Rectangle (filled)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Circle (outline)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Triangle (filled)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Star (outline)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Arrow (filled)' })).toBeInTheDocument();
  });

  it('calls onPick with "rect" when Rectangle is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ShapePicker activeTool="circle" fillModes={outlineModes} onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Rectangle/i }));
    expect(onPick).toHaveBeenCalledWith('rect');
  });

  it('calls onPick with "circle" when Circle is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ShapePicker activeTool="rect" fillModes={outlineModes} onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Circle/i }));
    expect(onPick).toHaveBeenCalledWith('circle');
  });

  it('calls onPick with "triangle" when Triangle is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ShapePicker activeTool="rect" fillModes={outlineModes} onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Triangle/i }));
    expect(onPick).toHaveBeenCalledWith('triangle');
  });

  it('calls onPick with "star" when Star is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ShapePicker activeTool="rect" fillModes={outlineModes} onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Star/i }));
    expect(onPick).toHaveBeenCalledWith('star');
  });

  it('calls onPick with "arrow" when Arrow is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ShapePicker activeTool="rect" fillModes={outlineModes} onPick={onPick} />);
    await user.click(screen.getByRole('menuitemradio', { name: /Arrow/i }));
    expect(onPick).toHaveBeenCalledWith('arrow');
  });
});
