import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolbarButton from './ToolbarButton';
import styles from './ToolbarButton.module.css';

const Icon = ({ size }: { size?: number }) => <svg data-testid="icon" width={size} />;

describe('ToolbarButton', () => {
  it('renders a button with the supplied icon and aria-label', () => {
    render(<ToolbarButton icon={Icon} aria-label="Pen" />);
    expect(screen.getByRole('button', { name: 'Pen' })).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ToolbarButton icon={Icon} aria-label="A" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sets aria-pressed only when pressed is defined (toggle mode)', () => {
    const { rerender } = render(<ToolbarButton icon={Icon} aria-label="A" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
    rerender(<ToolbarButton icon={Icon} aria-label="A" pressed={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<ToolbarButton icon={Icon} aria-label="A" pressed={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies the pressed class when pressed is true', () => {
    render(<ToolbarButton icon={Icon} aria-label="A" pressed />);
    expect(screen.getByRole('button')).toHaveClass(styles.pressed);
  });

  it('disables the button and blocks clicks when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ToolbarButton icon={Icon} aria-label="A" onClick={onClick} disabled />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the selected class when selected', () => {
    render(<ToolbarButton icon={Icon} aria-label="A" selected />);
    expect(screen.getByRole('button')).toHaveClass(styles.selected);
  });

  it('forwards data-* attributes to the button but drops unknown props', () => {
    render(
      <ToolbarButton
        icon={Icon}
        aria-label="A"
        data-testid="tb"
        data-tool="pen"
      />,
    );
    const btn = screen.getByTestId('tb');
    expect(btn).toHaveAttribute('data-tool', 'pen');
  });
});
