import { Children, type ReactNode } from 'react';
import ToolGroupClusterDivider from '@/editor/controls/ToolGroupClusterDivider';
import styles from './ToolGroupCluster.module.css';

export interface ToolGroupClusterProps {
  children: ReactNode;
  /**
   * When true (default), a vertical rule is rendered after this cluster.
   * Set false for the last cluster in a bar so you do not get a trailing line.
   */
  trailingDivider?: boolean;
  leadingDivider?: boolean;
  align?: 'left' | 'right';
}

/** Flex row for a group of tools; by default ends with a cluster divider. */
export default function ToolGroupCluster({
  children,
  trailingDivider = true,
  align = 'left',
  leadingDivider = false,
}: ToolGroupClusterProps) {
  const items = Children.toArray(children).filter((child) => child != null);
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.wrap} ${align === 'right' ? styles.right : ''}`}>
      {leadingDivider ? <ToolGroupClusterDivider /> : null}
      <div className={styles.cluster}>{items}</div>
      {trailingDivider ? <ToolGroupClusterDivider /> : null}
    </div>
  );
}
