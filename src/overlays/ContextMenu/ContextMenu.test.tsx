/**
 * Tests for `ContextMenu` — the portal-rendered right-click / controlled
 * menu. Focuses on: open/close in both modes, item activation, keyboard
 * navigation, disabled + separator + custom-content rows, outside-click and
 * Escape dismissal. Viewport-clamp geometry is skipped (needs real layout).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ContextMenu (uncontrolled)', () => {
  it('opens on right-click of the wrapped children and renders items', async () => {
    const onClick = vi.fn();
    const items: ContextMenuItem[] = [
      { label: 'Copy', onClick },
      { label: 'Paste' },
    ];
    render(
      <ContextMenu items={items}>
        <div data-testid="target">target</div>
      </ContextMenu>,
    );
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(screen.getByTestId('target'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeInTheDocument();
  });

  it('clicking an item fires onClick and closes the menu', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ContextMenu items={[{ label: 'Copy', onClick }]}>
        <div data-testid="target">target</div>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('target'));
    await user.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('outside mousedown closes the menu', () => {
    render(
      <ContextMenu items={[{ label: 'Copy' }]}>
        <div data-testid="target">target</div>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('target'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('ContextMenu (controlled)', () => {
  it('renders when open is true and does not render when false', () => {
    const { rerender } = render(
      <ContextMenu
        open={false}
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[{ label: 'Copy' }]}
      />,
    );
    expect(screen.queryByRole('menu')).toBeNull();
    rerender(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[{ label: 'Copy' }]}
      />,
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={onClose}
        items={[{ label: 'Copy' }]}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Tab is pressed (no focus-trapping)', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={onClose}
        items={[{ label: 'Copy' }]}
      />,
    );
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders separators as role=separator and they are not menuitems', () => {
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[
          { label: 'Copy' },
          { label: '---', separator: true },
          { label: 'Delete', variant: 'destructive' },
        ]}
      />,
    );
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('disabled items set aria-disabled and do not fire onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[{ label: 'Disabled', onClick, disabled: true }]}
      />,
    );
    const btn = screen.getByRole('menuitem', { name: 'Disabled' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('custom `content` rows render as-is and are skipped by keyboard nav', () => {
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[
          { label: 'First', content: <div data-testid="custom">custom row</div> },
          { label: 'Second' },
        ]}
      />,
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
    // Only one navigable menuitem exists (the custom row isn't one)
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('ArrowDown moves focus through navigable items and wraps', () => {
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[
          { label: 'One' },
          { label: 'Two' },
          { label: 'Three' },
        ]}
      />,
    );
    // Effect focuses first item on open
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus();
    // Wraps
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
  });

  it('ArrowUp wraps from first to last', () => {
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[{ label: 'One' }, { label: 'Two' }]}
      />,
    );
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
  });

  it('Home and End jump to first/last navigable items (skipping disabled)', () => {
    render(
      <ContextMenu
        open
        position={{ x: 10, y: 10 }}
        onClose={() => {}}
        items={[
          { label: 'One' },
          { label: 'Two', disabled: true },
          { label: 'Three' },
        ]}
      />,
    );
    fireEvent.keyDown(document, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Home' });
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
  });

  it('positions the menu using the provided coordinates', () => {
    render(
      <ContextMenu
        open
        position={{ x: 42, y: 84 }}
        onClose={() => {}}
        items={[{ label: 'Copy' }]}
      />,
    );
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '42px', top: '84px' });
  });

  it('renders shortcut text alongside the label', () => {
    render(
      <ContextMenu
        open
        position={{ x: 0, y: 0 }}
        onClose={() => {}}
        items={[{ label: 'Copy', shortcut: 'Ctrl+C' }]}
      />,
    );
    expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
  });
});
