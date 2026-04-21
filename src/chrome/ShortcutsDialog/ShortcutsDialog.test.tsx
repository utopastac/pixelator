/**
 * Tests for `ShortcutsDialog` — modal listing keyboard shortcuts. Covers
 * open/closed rendering, Escape key close, backdrop-click close, and that a
 * few representative group titles and shortcut labels are present.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortcutsDialog from './ShortcutsDialog';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ShortcutsDialog', () => {
  it('renders nothing when closed', () => {
    render(<ShortcutsDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders as a modal dialog with a title when open', () => {
    render(<ShortcutsDialog open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('contains the expected shortcut groups and at least one row per group', () => {
    render(<ShortcutsDialog open onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zoom & pan' })).toBeInTheDocument();
    // Spot-check a couple of labelled rows
    expect(screen.getByText('Pencil')).toBeInTheDocument();
    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.getByText('Fit to screen')).toBeInTheDocument();
  });

  it('closes on Escape keydown', () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not when the dialog body is clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    // Click on inner content (the heading) should not close
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Keyboard shortcuts' }));
    expect(onClose).not.toHaveBeenCalled();
    // MouseDown directly on the backdrop closes
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the header close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
