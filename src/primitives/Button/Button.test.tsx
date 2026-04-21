import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';
import styles from './Button.module.css';

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to primary variant', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass(styles.primary);
  });

  it('applies the secondary variant class', () => {
    render(<Button variant="secondary">Cancel</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass(styles.secondary);
    expect(btn).not.toHaveClass(styles.primary);
    expect(btn).not.toHaveClass(styles.destructive);
  });

  it('applies the destructive variant class', () => {
    render(<Button variant="destructive">Reset</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass(styles.destructive);
    expect(btn).not.toHaveClass(styles.primary);
  });

  it('applies the size class', () => {
    render(<Button size="md">Big</Button>);
    expect(screen.getByRole('button')).toHaveClass(styles.md);
  });

  it('forwards disabled to the underlying button', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards data-testid', () => {
    render(<Button data-testid="my-btn">Go</Button>);
    expect(screen.getByTestId('my-btn')).toBeInTheDocument();
  });
});
