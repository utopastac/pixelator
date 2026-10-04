import { useAppMobileOptional } from '@/AppMobileContext';
import styles from './IosCornerLink.module.css';

/**
 * Quiet desktop-only corner link to `/ios/`. Hidden on mobile — the toast and
 * Drawings menu cover discovery there.
 */
export default function IosCornerLink() {
  const isMobile = useAppMobileOptional()?.isMobile ?? false;
  if (isMobile) return null;

  return (
    <a
      className={styles.link}
      href="/ios/"
      data-testid="ios-corner-link"
    >
      Pixelator for iOS
    </a>
  );
}
