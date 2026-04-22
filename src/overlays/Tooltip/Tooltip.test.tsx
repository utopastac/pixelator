/**
 * Tests for `Tooltip` — portal-rendered tooltip shown on hover/focus.
 * Covers visibility on mouse and focus, hide on leave/blur, the optional
 * show delay (fake timers), and that the trigger receives `aria-describedby`
 * linking to the tooltip. Geometry is not exercised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppMobileContext } from '@/AppMobileContext';
import Tooltip, { _resetTooltipChainForTests } from './Tooltip';

beforeEach(() => {
  document.body.innerHTML = '';
  _resetTooltipChainForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('does not render content until the trigger is hovered', () => {
    render(
      <Tooltip content="Hello" delay={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }).parentElement!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hello');
  });

  it('hides on mouse leave', () => {
    render(
      <Tooltip content="Hello" delay={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows on focus and hides on blur', () => {
    render(
      <Tooltip content="Focused" delay={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.focus(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('waits for `delay` ms before appearing', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Later" delay={200}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('cancels a pending show if mouse leaves before the delay elapses', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Cancelled" delay={200}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = screen.getByRole('button', { name: 'Trigger' }).parentElement!;
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('links trigger to tooltip via aria-describedby when visible', () => {
    render(
      <Tooltip content="Described" delay={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).not.toHaveAttribute('aria-describedby');
    fireEvent.mouseEnter(trigger.parentElement!);
    const tip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tip.id);
  });

  it('renders only the child when app is in mobile layout (no tooltip wrapper)', () => {
    render(
      <AppMobileContext.Provider value={{ isMobile: true, setMobile: vi.fn() }}>
        <Tooltip content="Hidden on mobile" delay={0}>
          <button>Trigger</button>
        </Tooltip>
      </AppMobileContext.Provider>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.mouseEnter(trigger);
    fireEvent.focus(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
