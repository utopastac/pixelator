import styles from './ToolGroupClusterDivider.module.css';

/** Vertical rule after a `ToolGroupCluster` (that cluster appends it by default). */
export default function ToolGroupClusterDivider() {
  return <span className={styles.divider} aria-hidden="true" />;
}
