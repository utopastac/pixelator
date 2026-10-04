import { useState } from 'react';
import { CloseIcon } from '@/editor/icons/PixelToolIcons';
import styles from './IosPromoToast.module.css';

/** localStorage flag — once dismissed, the promo stays hidden across sessions. */
export const IOS_PROMO_DISMISSED_KEY = 'pixelator.iosPromoDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(IOS_PROMO_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(IOS_PROMO_DISMISSED_KEY, '1');
  } catch {
    /* quota / private mode — still hide for this session via state */
  }
}

/**
 * Dismissible top-center promo pointing at `/ios/`. Shown on both mobile and
 * desktop until the user closes it (persisted in localStorage).
 */
export default function IosPromoToast() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      data-testid="ios-promo-toast"
    >
      <p className={styles.copy}>
        <a className={styles.link} href="/ios/">
          Pixelator for iOS
        </a>
        <span className={styles.detail}> — iPhone, iPad &amp; Watch</span>
      </p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={dismiss}
        aria-label="Dismiss"
        data-testid="ios-promo-dismiss"
      >
        <CloseIcon size={16} aria-hidden />
      </button>
    </div>
  );
}
