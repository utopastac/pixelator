import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadoutButton from './ReadoutButton';
import styles from './ReadoutButton.module.css';

describe('ReadoutButton', () => {
  it('renders children inside a button element', () => {
    render(<ReadoutButton aria-label="Zoom">100%</ReadoutButton>);
    expect(screen.getByRole('button', { name: 'Zoom' })).toBeInTheDocument();
  });

  it('toggles the active class when active is true', () => {
    const { rerender } = render(<ReadoutButton aria-label="X">X</ReadoutButton>);
    expect(screen.getByRole('button')).not.toHaveClass(styles.active);
    rerender(<ReadoutButton aria-label="X" active>X</ReadoutButton>);
    expect(screen.getByRole('button')).toHaveClass(styles.active);
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ReadoutButton aria-label="X" onClick={onClick}>X</ReadoutButton>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<ReadoutButton aria-label="R" ref={ref}>R</ReadoutButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('forwards aria-label, aria-haspopup, and aria-expanded', () => {
    render(
      <ReadoutButton
        aria-label="Zoom"
        aria-haspopup="dialog"
        aria-expanded={true}
      >
        X
      </ReadoutButton>,
    );
    const btn = screen.getByRole('button', { name: 'Zoom' });
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('merges custom className', () => {
    render(<ReadoutButton aria-label="X" className="custom">X</ReadoutButton>);
    expect(screen.getByRole('button')).toHaveClass('custom');
  });
});
