import { useRef, useState } from 'react';
import ToolbarButton from '@/primitives/ToolbarButton';
import Popover from '@/overlays/Popover';
import SymmetryPicker from '@/editor/controls/SymmetryPicker';
import {
  SymmetryBothIcon,
  SymmetryHorizontalIcon,
  SymmetryVerticalIcon,
} from '@/editor/icons/PixelToolIcons';
import type { SymmetryMode } from '@/editor/lib/symmetry';
import styles from './SymmetryControl.module.css';

export interface SymmetryControlProps {
  symmetryMode: SymmetryMode;
  setSymmetryMode: (mode: SymmetryMode) => void;
}

export default function SymmetryControl({ symmetryMode, setSymmetryMode }: SymmetryControlProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const SymmetryIcon =
    symmetryMode === 'horizontal'
      ? SymmetryHorizontalIcon
      : symmetryMode === 'both'
        ? SymmetryBothIcon
        : SymmetryVerticalIcon;

  return (
    <>
      <div ref={anchorRef} className={styles.anchor}>
        <ToolbarButton
          icon={SymmetryIcon}
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          selected={symmetryMode !== 'none'}
          aria-label="Symmetry"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          tooltip={{ content: 'Mirroring', placement: 'bottom' }}
        />
      </div>
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={anchorRef}
        role="menu"
        aria-label="Symmetry mode"
      >
        <SymmetryPicker
          symmetryMode={symmetryMode}
          onPick={(mode) => {
            setSymmetryMode(mode);
            setIsOpen(false);
          }}
        />
      </Popover>
    </>
  );
}
