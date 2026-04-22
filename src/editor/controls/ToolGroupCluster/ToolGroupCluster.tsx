import type { ReactNode } from 'react';
import styles from './ToolGroupCluster.module.css';

export interface ToolGroupClusterProps {
  children: ReactNode;
}

/** Flex row for a floating tool group (e.g. title bar: title, pickers, toggles, history). */
export default function ToolGroupCluster({ children }: ToolGroupClusterProps) {
  return <div className={styles.cluster}>{children}</div>;
}
