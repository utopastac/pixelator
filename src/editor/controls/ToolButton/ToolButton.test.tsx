/**
 * Tests for `ToolButton` — icon button with optional tooltip and triangle indicator.
 * Covers aria-label, onPress, selected state, tooltip rendering, hasOptions
 * indicator, and size-driven icon dimensions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { _resetTooltipChainForTests } from '@/overlays/Tooltip/Tooltip';
import ToolButton from './ToolButton';
import styles from './ToolButton.module.css';

const Icon = ({ size }: { size?: number }) => <svg data-testid="icon" width={size} height={size} />;

beforeEach(() => {
  document.body.innerHTML = '';
  _resetTooltipChainForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToolButton', () => {
  it('renders the main button with the correct aria-label', () => {
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pen' })).toBeInTheDocument();
  });

  it('fires onPress when the main button is clicked (no chevron)', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={onPress} />);
    await user.click(screen.getByRole('button', { name: 'Pen' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies the selected CSS class to the wrapper div when selected', () => {
    const { container } = render(
      <ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} selected />,
    );
    const wrapper = container.querySelector(`.${styles.toolButton}`);
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain(styles.selected);
  });

  it('does not apply the selected class when selected is false', () => {
    const { container } = render(
      <ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} selected={false} />,
    );
    const wrapper = container.querySelector(`.${styles.toolButton}`);
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).not.toContain(styles.selected);
  });

  it('shows tooltip content when tooltip prop is a string and mouse enters', () => {
    vi.useFakeTimers();
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} tooltip="Pen tool" />);
    const btn = screen.getByRole('button', { name: 'Pen' });
    const tooltipWrapper = btn.parentElement!.parentElement!;
    fireEvent.mouseEnter(tooltipWrapper);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Pen tool');
  });

  it('does not render a tooltip when tooltip prop is omitted', () => {
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Pen' });
    fireEvent.mouseEnter(btn.parentElement!);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders only one button when chevron prop is provided', () => {
    render(
      <ToolButton
        icon={Icon}
        aria-label="Pen"
        onPress={() => {}}
        chevron={{ onClick: () => {}, 'aria-label': 'Open brush options' }}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Pen' })).toBeInTheDocument();
  });

  it('renders a corner indicator span when chevron prop is provided', () => {
    const { container } = render(
      <ToolButton
        icon={Icon}
        aria-label="Pen"
        onPress={() => {}}
        chevron={{ onClick: () => {}, 'aria-label': 'Open brush options' }}
      />,
    );
    expect(container.querySelector(`.${styles.cornerIndicator}`)).not.toBeNull();
  });

  it('does not render a corner indicator when chevron prop is omitted', () => {
    const { container } = render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} />);
    expect(container.querySelector(`.${styles.cornerIndicator}`)).toBeNull();
  });

  it('renders only one button when chevron prop is omitted', () => {
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders a 16px icon for size="sm"', () => {
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} size="sm" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('width', '16');
  });

  it('renders an 18px icon for size="md" (default)', () => {
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} size="md" />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('width', '18');
  });

  it('renders an 18px icon when size prop is omitted (defaults to md)', () => {
    render(<ToolButton icon={Icon} aria-label="Pen" onPress={() => {}} />);
    const svg = screen.getByTestId('icon');
    expect(svg).toHaveAttribute('width', '18');
  });
});
