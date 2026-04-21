import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FieldLabel from './FieldLabel';
import styles from './FieldLabel.module.css';

describe('FieldLabel', () => {
  it('renders the label text and wraps the provided children', () => {
    render(
      <FieldLabel label="Width">
        <input aria-label="w" />
      </FieldLabel>,
    );
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('w')).toBeInTheDocument();
  });

  it('associates the label with htmlFor', () => {
    render(
      <FieldLabel label="Name" htmlFor="name-id">
        <input id="name-id" />
      </FieldLabel>,
    );
    const label = screen.getByText('Name');
    expect(label).toHaveAttribute('for', 'name-id');
  });

  it('applies left-position class when labelPosition="left"', () => {
    const { container } = render(
      <FieldLabel label="L" labelPosition="left">
        <span />
      </FieldLabel>,
    );
    expect(container.firstChild).toHaveClass(styles.fieldLeft);
  });

  it('applies top-position class by default', () => {
    const { container } = render(
      <FieldLabel label="T">
        <span />
      </FieldLabel>,
    );
    expect(container.firstChild).toHaveClass(styles.fieldTop);
  });

  it('applies disabled class when disabled', () => {
    const { container } = render(
      <FieldLabel label="D" disabled>
        <span />
      </FieldLabel>,
    );
    expect(container.firstChild).toHaveClass(styles.disabled);
  });

  it('sets labelWidth as inline width style on the label', () => {
    render(
      <FieldLabel label="W" labelWidth={80}>
        <span />
      </FieldLabel>,
    );
    const label = screen.getByText('W');
    expect(label.style.width).toBe('80px');
  });

  it('applies sm size class by default and lg class when size="lg"', () => {
    const { rerender } = render(
      <FieldLabel label="S">
        <span />
      </FieldLabel>,
    );
    expect(screen.getByText('S')).toHaveClass(styles.sm);
    rerender(
      <FieldLabel label="S" size="lg">
        <span />
      </FieldLabel>,
    );
    expect(screen.getByText('S')).toHaveClass(styles.lg);
  });
});
