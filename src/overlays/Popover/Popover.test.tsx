/**
 * Popover focus + trap behaviour. jsdom lacks ResizeObserver, so we shim it
 * locally before importing the component.
 */
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

import Popover from './Popover';

interface HarnessProps {
  isOpen: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
}

function Harness({ isOpen, onClose = () => {}, children }: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef}>anchor</button>
      <Popover isOpen={isOpen} onClose={onClose} anchorRef={anchorRef} aria-label="pop">
        {children}
      </Popover>
    </>
  );
}

// requestAnimationFrame can stall in jsdom — flush two frames synchronously.
async function flushRaf() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

describe('Popover', () => {
  it('does not render anything when closed', () => {
    render(
      <Harness isOpen={false}>
        <button>inside</button>
      </Harness>,
    );
    expect(screen.queryByRole('button', { name: 'inside' })).not.toBeInTheDocument();
  });

  it('focuses the first focusable on open', async () => {
    render(
      <Harness isOpen={true}>
        <button>first</button>
        <button>second</button>
      </Harness>,
    );
    await flushRaf();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('sets aria-modal="true" on the portal container when open', () => {
    render(
      <Harness isOpen={true}>
        <button>x</button>
      </Harness>,
    );
    // aria-label on the popover is "pop".
    const popover = document.querySelector('[data-admin-popover]');
    expect(popover).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Harness isOpen={true} onClose={onClose}>
        <button>x</button>
      </Harness>,
    );
    await flushRaf();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('Tab from the last focusable cycles to the first', async () => {
    const user = userEvent.setup();
    render(
      <Harness isOpen={true}>
        <button>a</button>
        <button>b</button>
        <button>c</button>
      </Harness>,
    );
    await flushRaf();
    const a = screen.getByRole('button', { name: 'a' });
    const c = screen.getByRole('button', { name: 'c' });
    c.focus();
    expect(c).toHaveFocus();
    await user.tab();
    expect(a).toHaveFocus();
  });

  it('Shift+Tab from the first focusable cycles to the last', async () => {
    const user = userEvent.setup();
    render(
      <Harness isOpen={true}>
        <button>a</button>
        <button>b</button>
        <button>c</button>
      </Harness>,
    );
    await flushRaf();
    const a = screen.getByRole('button', { name: 'a' });
    const c = screen.getByRole('button', { name: 'c' });
    a.focus();
    expect(a).toHaveFocus();
    await user.tab({ shift: true });
    expect(c).toHaveFocus();
  });
});
