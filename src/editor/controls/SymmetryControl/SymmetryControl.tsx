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
  /** When true, show three inline mirroring toggles instead of a popover menu. */
  mobile?: boolean;
}

function toggleExclusive(
  mode: Exclude<SymmetryMode, 'none'>,
  current: SymmetryMode,
  setSymmetryMode: (mode: SymmetryMode) => void,
) {
  setSymmetryMode(current === mode ? 'none' : mode);
}

export default function SymmetryControl({ symmetryMode, setSymmetryMode, mobile = false }: SymmetryControlProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const SymmetryIcon =
    symmetryMode === 'horizontal'
      ? SymmetryHorizontalIcon
      : symmetryMode === 'both'
        ? SymmetryBothIcon
        : SymmetryVerticalIcon;

  if (mobile) {
    return (
      <div className={styles.mobileRow} role="group" aria-label="Symmetry mode">
        <ToolbarButton
          icon={SymmetryVerticalIcon}
          size="sm"
          selected={symmetryMode === 'vertical'}
          onClick={() => toggleExclusive('vertical', symmetryMode, setSymmetryMode)}
          aria-label="Vertical mirroring"
          tooltip={{ content: 'Vertical (left ↔ right)', placement: 'bottom' }}
        />
        <ToolbarButton
          icon={SymmetryHorizontalIcon}
          size="sm"
          selected={symmetryMode === 'horizontal'}
          onClick={() => toggleExclusive('horizontal', symmetryMode, setSymmetryMode)}
          aria-label="Horizontal mirroring"
          tooltip={{ content: 'Horizontal (top ↔ bottom)', placement: 'bottom' }}
        />
        <ToolbarButton
          icon={SymmetryBothIcon}
          size="sm"
          selected={symmetryMode === 'both'}
          onClick={() => toggleExclusive('both', symmetryMode, setSymmetryMode)}
          aria-label="Four-way mirroring"
          tooltip={{ content: '4-way', placement: 'bottom' }}
        />
      </div>
    );
  }

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
