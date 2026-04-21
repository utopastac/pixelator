import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorSwatch from './ColorSwatch';
import styles from './ColorSwatch.module.css';

describe('ColorSwatch', () => {
  it('renders a button with the colour as inline backgroundColor', () => {
    render(<ColorSwatch color="#ff0000" aria-label="red" />);
    const btn = screen.getByRole('button', { name: 'red' });
    // jsdom normalises this to `rgb(255, 0, 0)`.
    expect(btn.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('applies the selected class when selected', () => {
    const { rerender } = render(<ColorSwatch color="#000" aria-label="c" />);
    expect(screen.getByRole('button')).not.toHaveClass(styles.selected);
    rerender(<ColorSwatch color="#000" aria-label="c" selected />);
    expect(screen.getByRole('button')).toHaveClass(styles.selected);
  });

  it('applies the ring class when ring=true', () => {
    render(<ColorSwatch color="#000" aria-label="c" ring />);
    expect(screen.getByRole('button')).toHaveClass(styles.ring);
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ColorSwatch color="#000" aria-label="c" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies size and shape classes', () => {
    const { rerender } = render(
      <ColorSwatch color="#000" aria-label="c" size="md" shape="pill" />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass(styles.sizeMd);
    expect(btn).toHaveClass(styles.shapePill);
    rerender(
      <ColorSwatch color="#000" aria-label="c" size="sm" shape="rounded" />,
    );
    expect(screen.getByRole('button')).toHaveClass(styles.sizeSm);
    expect(screen.getByRole('button')).toHaveClass(styles.shapeRounded);
  });

  it('forwards aria-haspopup, aria-expanded, and title', () => {
    render(
      <ColorSwatch
        color="#000"
        aria-label="c"
        aria-haspopup="dialog"
        aria-expanded={true}
        title="tt"
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(btn).toHaveAttribute('title', 'tt');
  });

  it('forwards ref to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<ColorSwatch ref={ref} color="#000" aria-label="c" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
