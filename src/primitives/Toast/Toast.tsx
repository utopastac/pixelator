import React from 'react';
import styles from './Toast.module.css';

export interface ToastProps {
  message: string;
  'data-testid'?: string;
}

/**
 * Styled toast container. Handles visual presentation only (typography,
 * color, shadow, border-radius, padding, pointer-events: none).
 * Positioning is left to the caller via CSS in their own module files.
 */
const Toast: React.FC<ToastProps> = ({ message, 'data-testid': dataTestId }) => {
  return (
    <div role="status" aria-live="polite" className={styles.toast} data-testid={dataTestId}>
      {message}
    </div>
  );
};

export default Toast;
