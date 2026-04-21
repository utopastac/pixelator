import React from 'react';
import styles from './MenuPopover.module.css';

export interface MenuPopoverProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const MenuPopover: React.FC<MenuPopoverProps> = ({ children, className = '', style }) => (
  <div className={`${styles.menuPopover} ${className}`.trim()} style={style}>
    {children}
  </div>
);

export default MenuPopover;
