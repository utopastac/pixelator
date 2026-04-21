import React from 'react';
import { ChevronSmIcon } from '@/editor/icons/PixelToolIcons';
import styles from './DrawingGroup.module.css';

export interface DrawingGroupProps {
  label: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * Collapsible group header for the drawings panel. Owns the toggle button
 * and the indented rows container; callers render the row children.
 */
export default function DrawingGroup({ label, isCollapsed, onToggle, children }: DrawingGroupProps) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      <button
        className={styles.groupHeader}
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <span className={`${styles.groupChevron} ${isCollapsed ? styles.groupChevronCollapsed : styles.groupChevronExpanded}`}>
          <ChevronSmIcon size={14} />
        </span>
        <span>{label}</span>
      </button>
      {!isCollapsed && (
        <div className={styles.groupRows}>
          {children}
        </div>
      )}
    </div>
  );
}
