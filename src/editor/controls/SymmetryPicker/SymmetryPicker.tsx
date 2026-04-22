import React from 'react';
import { SymmetryVerticalIcon, SymmetryHorizontalIcon, SymmetryBothIcon, CloseIcon } from '../../icons/PixelToolIcons';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import type { SymmetryMode } from '../../lib/symmetry';
import MenuPopover from '@/primitives/MenuPopover';

export interface SymmetryPickerProps {
  symmetryMode: SymmetryMode;
  onPick: (mode: SymmetryMode) => void;
}

/**
 * Popover content for choosing a symmetry mode. The parent owns the open state;
 * this component only renders the menu body and fires `onPick` on selection.
 */
const SymmetryPicker: React.FC<SymmetryPickerProps> = ({ symmetryMode, onPick }) => (
  <MenuPopover>
    <PopoverMenuItem
      icon={SymmetryVerticalIcon}
      label="Vertical (left ↔ right)"
      selected={symmetryMode === 'vertical'}
      onClick={() => onPick('vertical')}
    />
    <PopoverMenuItem
      icon={SymmetryHorizontalIcon}
      label="Horizontal (top ↔ bottom)"
      selected={symmetryMode === 'horizontal'}
      onClick={() => onPick('horizontal')}
    />
    <PopoverMenuItem
      icon={SymmetryBothIcon}
      label="4-way"
      selected={symmetryMode === 'both'}
      onClick={() => onPick('both')}
    />
    <PopoverMenuItem
      icon={CloseIcon}
      label="None"
      selected={symmetryMode === 'none'}
      onClick={() => onPick('none')}
    />
  </MenuPopover>
);

export default SymmetryPicker;
