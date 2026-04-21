import React, { useRef, useState, useEffect } from 'react';
import { PALETTES, getPalette } from '@/lib/palettes';
import { hsvToHex, hexToHsv } from '@/lib/colorUtils';
import ColorPicker from '@/primitives/ColorPicker/ColorPicker';
import ColorSwatch from '@/primitives/ColorSwatch';
import CompactInput from '@/primitives/CompactInput';
import Popover from '@/overlays/Popover';
import PopoverMenuItem from '@/overlays/PopoverMenuItem';
import Tooltip from '@/overlays/Tooltip';
import { ChevronSmIcon } from '../icons/PixelToolIcons';
import { HEX_REGEX } from '../lib/pixelArtUtils';
import MenuPopover from '@/primitives/MenuPopover';
import styles from './SwatchesPopover.module.css';

export interface SwatchesPopoverProps {
  activeColor: string;
  setActiveColor: (c: string) => void;
  palette: string[];
  paletteId?: string;
  onPaletteChange?: (id: string) => void;
  customColors: string[];
  onAddCustomColor?: (color: string) => void;
  independentHue: number | null;
  setIndependentHue: (h: number | null) => void;
}

/**
 * Active-color swatch trigger + colour picker popover. Contains the hex input,
 * optional palette picker, the ColorPicker gradient, the palette swatches, and
 * the custom-colors grid. Appending to the custom-colors list on close is
 * delegated to `onAddCustomColor`, which App owns.
 */
const SwatchesPopover: React.FC<SwatchesPopoverProps> = ({
  activeColor,
  setActiveColor,
  palette,
  paletteId,
  onPaletteChange,
  customColors,
  onAddCustomColor,
  independentHue,
  setIndependentHue,
}) => {
  const activeColorSwatchRef = useRef<HTMLButtonElement>(null);
  const paletteHeaderRef = useRef<HTMLButtonElement>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isPaletteMenuOpen, setIsPaletteMenuOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(() => activeColor.replace(/^#/, ''));

  // Sync draft when activeColor changes from outside (canvas picker, swatch clicks).
  // Typing only commits to activeColor on a complete valid hex, so at that point
  // the draft already matches — this effect is a no-op in that case.
  useEffect(() => {
    setHexDraft(activeColor.replace(/^#/, ''));
  }, [activeColor]);

  return (
    <>
      <Tooltip content="Colors" placement="top" delay={400}>
        <ColorSwatch
          ref={activeColorSwatchRef}
          color={HEX_REGEX.test(activeColor) ? activeColor : '#000000'}
          size="md"
          shape="pill"
          ring
          onClick={() => setIsColorPickerOpen((prev) => !prev)}
          aria-label="Colors"
          aria-haspopup="dialog"
          aria-expanded={isColorPickerOpen}
        />
      </Tooltip>
      <Popover
        isOpen={isColorPickerOpen}
        onClose={() => {
          // When the popover closes, if the active colour is a valid hex
          // that isn't in the current palette or custom list, append it
          // to the custom colours so the user can get back to it later.
          if (
            onAddCustomColor &&
            HEX_REGEX.test(activeColor) &&
            !palette.includes(activeColor) &&
            !customColors.includes(activeColor)
          ) {
            onAddCustomColor(activeColor);
          }
          setIsColorPickerOpen(false);
        }}
        anchorRef={activeColorSwatchRef}
        role="dialog"
        className={styles.colorPickerPopover}
        aria-label="Colors"
      >
        <div className={styles.swatchesPopover}>
          <div className={styles.hexRow}>
            <CompactInput
              prefix="#"
              id="hex-color-input"
              value={hexDraft}
              onChange={(raw) => {
                const stripped = raw.replace(/^#/, '');
                setHexDraft(stripped);
                const hex = '#' + stripped;
                if (HEX_REGEX.test(hex)) {
                  setIndependentHue(null);
                  setActiveColor(hex.toLowerCase());
                }
              }}
            />
            {paletteId !== undefined && onPaletteChange && (
              <>
                <Tooltip content="Palette" placement="bottom" delay={400}>
                  <button
                    ref={paletteHeaderRef}
                    type="button"
                    className={`${styles.paletteHeader} ${isPaletteMenuOpen ? styles.paletteHeaderActive : ''}`}
                    onClick={() => setIsPaletteMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isPaletteMenuOpen}
                    aria-label={`Palette: ${getPalette(paletteId).name}`}
                  >
                    <span className={styles.paletteHeaderLabel}>
                      {getPalette(paletteId).name}
                    </span>
                    <ChevronSmIcon size={14} />
                  </button>
                </Tooltip>
                <Popover
                  isOpen={isPaletteMenuOpen}
                  onClose={() => setIsPaletteMenuOpen(false)}
                  anchorRef={paletteHeaderRef}
                  role="menu"
                  aria-label="Palette picker"
                >
                  <MenuPopover>
                    {PALETTES.map((p) => (
                      <PopoverMenuItem
                        key={p.id}
                        label={p.name}
                        selected={paletteId === p.id}
                        onClick={() => {
                          onPaletteChange(p.id);
                          setIsPaletteMenuOpen(false);
                        }}
                      />
                    ))}
                  </MenuPopover>
                </Popover>
              </>
            )}
          </div>
          <div className={styles.colorPickerBody}>
            <ColorPicker
              hue={(() => {
                const hsv = HEX_REGEX.test(activeColor) ? hexToHsv(activeColor) : { h: 0, s: 1, v: 1 };
                return independentHue !== null ? independentHue : hsv.h;
              })()}
              saturation={HEX_REGEX.test(activeColor) ? hexToHsv(activeColor).s : 1}
              brightness={HEX_REGEX.test(activeColor) ? hexToHsv(activeColor).v : 1}
              onChange={(h, s, v) => {
                setIndependentHue(h);
                setActiveColor(hsvToHex(h, s, v));
              }}
            />
          </div>
          <div className={styles.swatchScroll}>
            <div className={styles.swatchGrid}>
              {/* Dedupe before render. Some palettes (e.g. NES) repeat
                  colours as padding to align their rows; rendering the
                  raw list produces duplicate swatches (and duplicate
                  React keys). Case-insensitive so #FFF and #fff collapse. */}
              {Array.from(new Set(palette.map((c) => c.toLowerCase()))).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  selected={activeColor.toLowerCase() === color}
                  onClick={() => {
                    setActiveColor(color);
                    setIndependentHue(null);
                  }}
                  aria-label={`Select color ${color}`}
                  title={color}
                />
              ))}
            </div>
            {customColors.length > 0 && (
              <>
                <div className={styles.swatchDivider} aria-hidden="true" />
                <div className={styles.swatchGrid}>
                  {customColors.map((color) => (
                    <ColorSwatch
                      key={`custom-${color}`}
                      color={color}
                      selected={activeColor === color}
                      onClick={() => {
                        setActiveColor(color);
                        setIndependentHue(null);
                      }}
                      aria-label={`Select color ${color}`}
                      title={color}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
};

export default SwatchesPopover;
