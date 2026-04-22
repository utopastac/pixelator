import styles from './ToolGroupClusterDivider.module.css';

/** Vertical rule between groups inside a `ToolGroupCluster`. */
export default function ToolGroupClusterDivider() {
  return <span className={styles.divider} aria-hidden="true" />;
}
