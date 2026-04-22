import React, { useRef, useState } from 'react';
import Button from '@/primitives/Button';
import CompactInput from '@/primitives/CompactInput';
import Popover from '@/overlays/Popover';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import ReadoutButton from '@/primitives/ReadoutButton';
import Tooltip from '@/overlays/Tooltip';
import { CheckIcon } from '@/editor/icons/PixelToolIcons';
import MenuPopover from '@/primitives/MenuPopover';
import styles from './CanvasSizePicker.module.css';

/** Bounds for the size picker's custom W/H inputs. Above ~256 the per-commit
 *  composite redraw starts to feel laggy during paint-drags. */
const CUSTOM_SIZE_MIN = 4;
const CUSTOM_SIZE_MAX = 256;

interface CustomSizeRowProps {
  currentWidth: number | undefined;
  currentHeight: number | undefined;
  /** True when the current canvas size doesn't match any of the square
   *  presets — the row shows a leading checkmark in that case, matching the
   *  preset rows' radio indicator. */
  selected: boolean;
  onApply: (width: number, height: number) => void;
}

/** Two CompactInput fields (matching the opacity slider in LayersPanel) + an
 *  Apply button, rendered at the bottom of the canvas-size popover for
 *  non-preset dimensions. Mirrors PopoverMenuItem's anatomy — leading
 *  checkmark slot + inline body — so its content aligns with the preset
 *  rows above. Draft values reset to the current size each time the popover
 *  re-mounts, so closing without applying discards uncommitted values. */
const CustomSizeRow: React.FC<CustomSizeRowProps> = ({ currentWidth, currentHeight, selected, onApply }) => {
  const clamp = (n: number) => Math.max(CUSTOM_SIZE_MIN, Math.min(CUSTOM_SIZE_MAX, n));
  const [draftW, setDraftW] = useState<string>(String(currentWidth ?? 32));
  const [draftH, setDraftH] = useState<string>(String(currentHeight ?? 32));

  const apply = () => {
    const w = clamp(parseInt(draftW, 10));
    const h = clamp(parseInt(draftH, 10));
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    onApply(w, h);
  };

  return (
    <div
      className={styles.customSizeRow}
      role="menuitemradio"
      aria-checked={selected}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); apply(); }
      }}
    >
      {selected
        ? <span aria-hidden="true" className={styles.customSizeCheck}><CheckIcon size={14} /></span>
        : <span className={styles.customSizeSlot} aria-hidden="true" />}
      <div className={styles.customSizeControls}>
        <CompactInput
          prefix=""
          value={draftW}
          onChange={setDraftW}
          min={CUSTOM_SIZE_MIN}
          max={CUSTOM_SIZE_MAX}
          step={1}
          scrub
          width={44}
        />
        <span className={styles.customSizeX} aria-hidden="true">×</span>
        <CompactInput
          prefix=""
          value={draftH}
          onChange={setDraftH}
          min={CUSTOM_SIZE_MIN}
          max={CUSTOM_SIZE_MAX}
          step={1}
          scrub
          width={44}
        />
        <Button className={styles.customSizeApply} onClick={apply} data-testid="size-apply-custom">Apply</Button>
      </div>
    </div>
  );
};

export interface CanvasSizePickerProps {
  sizes: number[];
  currentWidth?: number;
  currentHeight?: number;
  onPickSize?: (width: number, height: number) => void;
}

/**
 * Canvas-size readout button + preset/custom popover. Owns its own open
 * state and anchor ref. Parent decides whether to render it based on the
 * `sizes` prop (no conditional logic in this component).
 */
const CanvasSizePicker: React.FC<CanvasSizePickerProps> = ({
  sizes,
  currentWidth,
  currentHeight,
  onPickSize,
}) => {
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const sizeAnchorRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sizeAnchorRef} className={styles.sizeReadoutAnchor}>
      <Tooltip content="Canvas size" placement="bottom" delay={400}>
        <ReadoutButton
          active={isSizeMenuOpen}
          onClick={() => setIsSizeMenuOpen((prev) => !prev)}
          aria-label={`Canvas size: ${currentWidth ?? '?'} by ${currentHeight ?? '?'}`}
          aria-haspopup="menu"
          aria-expanded={isSizeMenuOpen}
          className={styles.sizeReadoutButton}
          data-testid="canvas-size-picker"
        >
          <span>{currentWidth}×{currentHeight}</span>
        </ReadoutButton>
      </Tooltip>
      <Popover
        isOpen={isSizeMenuOpen}
        onClose={() => setIsSizeMenuOpen(false)}
        anchorRef={sizeAnchorRef}
        role="menu"
        aria-label="Canvas size"
      >
        <MenuPopover>
          {sizes.map((s) => (
            <PopoverMenuItem
              key={s}
              label={`${s} × ${s}`}
              selected={currentWidth === s && currentHeight === s}
              testId={`size-preset-${s}`}
              onClick={() => { setIsSizeMenuOpen(false); onPickSize?.(s, s); }}
            />
          ))}
          <div className={styles.menuSeparator} role="separator" />
          <CustomSizeRow
            currentWidth={currentWidth}
            currentHeight={currentHeight}
            selected={!sizes.some((s) => currentWidth === s && currentHeight === s)}
            onApply={(w, h) => { setIsSizeMenuOpen(false); onPickSize?.(w, h); }}
          />
        </MenuPopover>
      </Popover>
    </div>
  );
};

export default CanvasSizePicker;
