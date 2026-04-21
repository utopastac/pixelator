import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolbarChevron from './ToolbarChevron';

describe('ToolbarChevron', () => {
  it('renders a button with the supplied aria-label', () => {
    render(<ToolbarChevron onClick={() => {}} aria-label="Open brush sizes" />);
    expect(screen.getByRole('button', { name: 'Open brush sizes' })).toBeInTheDocument();
  });

  it('defaults aria-haspopup to "dialog"', () => {
    render(<ToolbarChevron onClick={() => {}} aria-label="A" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('forwards the aria-haspopup value when explicitly provided', () => {
    render(<ToolbarChevron onClick={() => {}} aria-label="A" aria-haspopup="menu" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ToolbarChevron onClick={onClick} aria-label="A" />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as type="button" so it does not submit forms', () => {
    render(<ToolbarChevron onClick={() => {}} aria-label="A" />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
