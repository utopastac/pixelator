import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FloatingPanel, { FloatingPanelPosition } from './FloatingPanel';
import styles from './FloatingPanel.module.css';

describe('FloatingPanel', () => {
  it('renders children', () => {
    render(
      <FloatingPanel>
        <span>content</span>
      </FloatingPanel>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('defaults to bottom-center position and md size', () => {
    const { container } = render(<FloatingPanel>x</FloatingPanel>);
    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveClass(styles.panel);
    expect(panel).toHaveClass(styles.bottomCenter);
    expect(panel).toHaveClass(styles.md);
  });

  it.each<[FloatingPanelPosition, keyof typeof styles]>([
    ['top-center', 'topCenter'],
    ['top-right', 'topRight'],
    ['top-left', 'topLeft'],
    ['right-center', 'rightCenter'],
    ['left-center', 'leftCenter'],
  ])('maps position=%s to the correct class', (position, key) => {
    const { container } = render(
      <FloatingPanel position={position}>x</FloatingPanel>,
    );
    expect(container.firstChild).toHaveClass(styles[key]);
  });

  it('applies sm size class when size="sm"', () => {
    const { container } = render(<FloatingPanel size="sm">x</FloatingPanel>);
    expect(container.firstChild).toHaveClass(styles.sm);
  });

  it('applies mobile hook class when mobile is true', () => {
    const { container } = render(<FloatingPanel mobile>x</FloatingPanel>);
    expect(container.firstChild).toHaveClass(styles.mobile);
  });

  it('forwards role, aria-label, className, and style', () => {
    render(
      <FloatingPanel
        role="toolbar"
        aria-label="Tools"
        className="extra"
        style={{ top: 10 }}
      >
        x
      </FloatingPanel>,
    );
    const panel = screen.getByRole('toolbar', { name: 'Tools' });
    expect(panel).toHaveClass('extra');
    expect(panel.style.top).toBe('10px');
  });
});
