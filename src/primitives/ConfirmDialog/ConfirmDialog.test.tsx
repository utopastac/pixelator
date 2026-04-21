import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="t"
        body="b"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('renders title, body, and both action buttons when open', () => {
    render(
      <ConfirmDialog
        open
        title="Reset app?"
        body="This clears everything."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Reset app?' })).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeInTheDocument();
  });

  it('focuses Cancel by default so an errant Enter does not confirm', () => {
    render(
      <ConfirmDialog open title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByTestId('confirm-dialog-cancel')).toHaveFocus();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="t" body="b" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="t" body="b" onConfirm={() => {}} onCancel={onCancel} />,
    );
    await user.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="t" body="b" onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the backdrop is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="t" body="b" onConfirm={() => {}} onCancel={onCancel} />,
    );
    fireEvent.mouseDown(screen.getByTestId('confirm-dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a tertiary action button when tertiaryLabel + onTertiary are both provided', async () => {
    const user = userEvent.setup();
    const onTertiary = vi.fn();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        body="b"
        tertiaryLabel="Export backup"
        onTertiary={onTertiary}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const tertiary = screen.getByTestId('confirm-dialog-tertiary');
    await user.click(tertiary);
    expect(onTertiary).toHaveBeenCalledTimes(1);
    // Clicking the tertiary does NOT close the dialog or fire confirm/cancel.
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('omits the tertiary button when either tertiaryLabel or onTertiary is missing', () => {
    render(
      <ConfirmDialog open title="t" body="b" tertiaryLabel="X" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByTestId('confirm-dialog-tertiary')).toBeNull();
  });

  it('uses a caller-supplied testId on the root when provided', () => {
    render(
      <ConfirmDialog
        open
        title="t"
        body="b"
        testId="confirm-delete-drawing"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    // The custom testid lets callers target a specific dialog mount; the
    // default `confirm-dialog` is replaced so queries don't collide if
    // multiple dialogs were ever mounted at the same time.
    expect(screen.getByTestId('confirm-delete-drawing')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('passes destructive flag through to the confirm button', () => {
    render(
      <ConfirmDialog
        open
        title="t"
        body="b"
        destructive
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const confirm = screen.getByTestId('confirm-dialog-confirm');
    expect(confirm.className).toMatch(/destructive/);
  });
});
