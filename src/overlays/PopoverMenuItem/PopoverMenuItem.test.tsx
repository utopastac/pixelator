import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PopoverMenuItem from './PopoverMenuItem';

describe('PopoverMenuItem', () => {
  it('renders label text on a plain menuitem when selected is undefined', () => {
    render(<PopoverMenuItem label="Export" />);
    const item = screen.getByRole('menuitem', { name: 'Export' });
    expect(item).toBeInTheDocument();
    expect(item).not.toHaveAttribute('aria-checked');
  });

  it('renders a menuitemradio with aria-checked=true when selected', () => {
    render(<PopoverMenuItem label="On" selected />);
    const item = screen.getByRole('menuitemradio', { name: 'On' });
    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('renders a menuitemradio with aria-checked=false when selected=false', () => {
    render(<PopoverMenuItem label="Off" selected={false} />);
    const item = screen.getByRole('menuitemradio', { name: 'Off' });
    expect(item).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onClick when activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PopoverMenuItem label="Go" onClick={onClick} />);
    await user.click(screen.getByRole('menuitem', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PopoverMenuItem label="D" onClick={onClick} disabled />);
    const item = screen.getByRole('menuitem', { name: 'D' });
    expect(item).toBeDisabled();
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a leading icon when provided', () => {
    const Icon = ({ size }: { size?: number }) => (
      <svg data-testid="icon" width={size} />
    );
    render(<PopoverMenuItem label="With icon" icon={Icon} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('forwards testId onto the button as data-testid', () => {
    render(<PopoverMenuItem label="Tagged" testId="my-item" />);
    expect(screen.getByTestId('my-item')).toBe(
      screen.getByRole('menuitem', { name: 'Tagged' }),
    );
  });
});
