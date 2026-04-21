/**
 * Tests for `RecentColorsPanel` — left-edge floating column of recent colour
 * swatches with pinned black and white at the bottom.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecentColorsPanel from './RecentColorsPanel';

describe('RecentColorsPanel', () => {
  it('always renders black and white pinned swatches even when recents is empty', () => {
    render(<RecentColorsPanel recents={[]} activeColor="#ff0000" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Black' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'White' })).toBeInTheDocument();
  });

  it('renders one swatch per recent colour (excluding black and white)', () => {
    render(
      <RecentColorsPanel
        recents={['#ff0000', '#00ff00', '#0000ff']}
        activeColor="#000000"
        onPick={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Use recent color #ff0000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use recent color #00ff00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use recent color #0000ff' })).toBeInTheDocument();
  });

  it('filters black and white from recents to avoid duplication with pinned swatches', () => {
    render(
      <RecentColorsPanel
        recents={['#000000', '#ff0000', '#ffffff']}
        activeColor="#aabbcc"
        onPick={() => {}}
      />,
    );
    // #ff0000 shows in the recents section.
    expect(screen.getByRole('button', { name: 'Use recent color #ff0000' })).toBeInTheDocument();
    // #000000 and #ffffff appear only as pinned swatches, not as recents.
    expect(screen.queryByRole('button', { name: 'Use recent color #000000' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use recent color #ffffff' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Black' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'White' })).toBeInTheDocument();
  });

  it('shows a divider when there are recents to display', () => {
    render(
      <RecentColorsPanel recents={['#ff0000']} activeColor="#000000" onPick={() => {}} />,
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('does not show a divider when recents is empty (only pinned swatches)', () => {
    render(<RecentColorsPanel recents={[]} activeColor="#000000" onPick={() => {}} />);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('does not show a divider when recents contains only black and white', () => {
    render(
      <RecentColorsPanel recents={['#000000', '#ffffff']} activeColor="#000000" onPick={() => {}} />,
    );
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('fires onPick with the clicked recent colour', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <RecentColorsPanel recents={['#ff0000', '#00ff00']} activeColor="#000000" onPick={onPick} />,
    );
    await user.click(screen.getByRole('button', { name: 'Use recent color #00ff00' }));
    expect(onPick).toHaveBeenCalledWith('#00ff00');
  });

  it('fires onPick with #000000 when the Black swatch is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<RecentColorsPanel recents={[]} activeColor="#ff0000" onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'Black' }));
    expect(onPick).toHaveBeenCalledWith('#000000');
  });

  it('fires onPick with #ffffff when the White swatch is clicked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<RecentColorsPanel recents={[]} activeColor="#ff0000" onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'White' }));
    expect(onPick).toHaveBeenCalledWith('#ffffff');
  });

  it('marks the swatch whose colour matches activeColor (lowercased)', () => {
    render(
      <RecentColorsPanel
        recents={['#aabbcc', '#112233']}
        activeColor="#AABBCC"
        onPick={() => {}}
      />,
    );
    const match = screen.getByRole('button', { name: 'Use recent color #aabbcc' });
    const other = screen.getByRole('button', { name: 'Use recent color #112233' });
    expect(match.className).toMatch(/(^|[ _])selected(_|$)/);
    expect(other.className).not.toMatch(/(^|[ _])selected(_|$)/);
  });

  it('marks the Black swatch selected when activeColor is #000000', () => {
    render(<RecentColorsPanel recents={[]} activeColor="#000000" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Black' }).className).toMatch(/(^|[ _])selected(_|$)/);
    expect(screen.getByRole('button', { name: 'White' }).className).not.toMatch(/(^|[ _])selected(_|$)/);
  });
});
