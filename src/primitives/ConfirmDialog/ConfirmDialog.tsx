import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/primitives/Button';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive (red) variant. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional third action — typically a non-destructive escape hatch (e.g.
   *  "Export backup" before a reset). Clicking it fires `onTertiary` but does
   *  NOT close the dialog: the user stays in the dialog and then makes their
   *  explicit Cancel / Confirm choice afterwards. */
  tertiaryLabel?: string;
  onTertiary?: () => void;
  /** Optional per-mount testid. Supplements (not replaces) the standard
   *  `confirm-dialog` root testid so callers can target a specific mount
   *  (e.g. `confirm-delete-drawing` vs `confirm-reset-drawing`). */
  testId?: string;
}

/** Modal confirmation dialog. Focus lands on the Cancel button by default so
 *  an errant Enter can't fire a destructive action. Escape and backdrop click
 *  both cancel. Uses a portal to escape ancestor `overflow: hidden`. */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  tertiaryLabel,
  onTertiary,
  testId,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      data-testid={testId ?? 'confirm-dialog'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={styles.card}>
        <h2 id="confirm-dialog-title" className={styles.title}>{title}</h2>
        <div className={styles.body}>{body}</div>
        <div className={styles.actions}>
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            aria-label={cancelLabel}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </Button>
          {tertiaryLabel && onTertiary && (
            <Button
              variant="primary"
              onClick={onTertiary}
              aria-label={tertiaryLabel}
              data-testid="confirm-dialog-tertiary"
            >
              {tertiaryLabel}
            </Button>
          )}
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            aria-label={confirmLabel}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmDialog;
