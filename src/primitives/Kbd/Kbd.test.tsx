import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Kbd from './Kbd';
import styles from './Kbd.module.css';

describe('Kbd', () => {
  it('renders children inside a <kbd> element', () => {
    render(<Kbd>Ctrl</Kbd>);
    const el = screen.getByText('Ctrl');
    expect(el.tagName).toBe('KBD');
  });

  it('applies the module kbd class and merges additional className', () => {
    render(<Kbd className="extra">X</Kbd>);
    const el = screen.getByText('X');
    expect(el).toHaveClass(styles.kbd);
    expect(el).toHaveClass('extra');
  });

  it('forwards HTML attributes to the underlying element', () => {
    render(
      <Kbd title="shortcut" data-testid="k">
        C
      </Kbd>,
    );
    const el = screen.getByTestId('k');
    expect(el).toHaveAttribute('title', 'shortcut');
  });
});
