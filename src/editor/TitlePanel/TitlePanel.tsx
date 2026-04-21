import React, { useRef, useState } from 'react';
import FloatingPanel from '@/primitives/FloatingPanel';
import EditableText from '@/primitives/EditableText';
import ToolbarButton from '@/primitives/ToolbarButton';
import Popover from '@/overlays/Popover';
import { BackIcon, ForwardIcon, TilingIcon, WrapIcon, SymmetryVerticalIcon, SymmetryHorizontalIcon, SymmetryBothIcon, PaintInsideIcon } from '../icons/PixelToolIcons';
import ZoomControls from '../ZoomControls/ZoomControls';
import CanvasSizePicker from '../CanvasSizePicker';
import SymmetryPicker from '../Toolbar/SymmetryPicker';
import type { SymmetryMode } from '../lib/symmetry';
import type { UseViewportReturn } from '../hooks/useViewport';
import styles from './TitlePanel.module.css';

export interface TitlePanelProps {
  /** Editable drawing title. */
  title: string;
  onTitleChange: (next: string) => void;

  /** Optional list of preset SQUARE grid sizes. When provided, a picker button
   *  is rendered next to the title. When omitted, the picker is hidden. */
  sizes?: number[];
  currentWidth?: number;
  currentHeight?: number;
  onPickSize?: (width: number, height: number) => void;

  /** Viewport controller for the Photoshop-style zoom/pan cluster. */
  viewport?: Pick<UseViewportReturn, 'zoom' | 'setZoom' | 'fit' | 'isAutoFit'>;

  tilingEnabled?: boolean;
  setTilingEnabled?: (v: boolean) => void;

  wrapMode?: boolean;
  setWrapMode?: (v: boolean) => void;

  symmetryMode?: SymmetryMode;
  setSymmetryMode?: (mode: SymmetryMode) => void;

  alphaLock?: boolean;
  setAlphaLock?: (v: boolean) => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Top-center floating panel: editable title, optional canvas-size picker,
 * optional zoom controls, and undo/redo. Rendered only when a title is
 * provided by the parent.
 */
const TitlePanel: React.FC<TitlePanelProps> = ({
  title,
  onTitleChange,
  sizes,
  currentWidth,
  currentHeight,
  onPickSize,
  viewport,
  tilingEnabled,
  setTilingEnabled,
  wrapMode,
  setWrapMode,
  symmetryMode,
  setSymmetryMode,
  alphaLock,
  setAlphaLock,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const showSizePicker = Array.isArray(sizes) && sizes.length > 0;
  const symmetryAnchorRef = useRef<HTMLDivElement>(null);
  const [isSymmetryOpen, setIsSymmetryOpen] = useState(false);
  const SymmetryIcon = symmetryMode === 'horizontal' ? SymmetryHorizontalIcon : symmetryMode === 'both' ? SymmetryBothIcon : SymmetryVerticalIcon;

  return (
    <FloatingPanel position="top-center" size="sm" aria-label="Drawing title">
      <div className={styles.titleCluster}>
        <EditableText
          value={title}
          onChange={onTitleChange}
          size="sm"
          ariaLabel="Drawing name"
        />
        {showSizePicker && (
          <>
            <span className={styles.titleDivider} aria-hidden="true" />
            <CanvasSizePicker
              sizes={sizes!}
              currentWidth={currentWidth}
              currentHeight={currentHeight}
              onPickSize={onPickSize}
            />
          </>
        )}
        {viewport && (
          <>
            <span className={styles.titleDivider} aria-hidden="true" />
            <ZoomControls viewport={viewport} />
          </>
        )}
        {setTilingEnabled != null && (
          <>
            <ToolbarButton
              icon={TilingIcon}
              size="sm"
              onClick={() => setTilingEnabled(!tilingEnabled)}
              selected={tilingEnabled}
              aria-label="Tiling preview"
              tooltip={{ content: 'Tiling preview', placement: 'bottom' }}
            />
          </>
        )}
        {setSymmetryMode != null && (
          <>
            <span className={styles.titleDivider} aria-hidden="true" />
            <div ref={symmetryAnchorRef}>
              <ToolbarButton
                icon={SymmetryIcon}
                size="sm"
                onClick={() => setIsSymmetryOpen((prev) => !prev)}
                selected={symmetryMode !== 'none'}
                aria-label="Symmetry"
                aria-haspopup="menu"
                aria-expanded={isSymmetryOpen}
                tooltip={{ content: 'Mirroring', placement: 'bottom' }}
              />
            </div>
            <Popover
              isOpen={isSymmetryOpen}
              onClose={() => setIsSymmetryOpen(false)}
              anchorRef={symmetryAnchorRef}
              role="menu"
              aria-label="Symmetry mode"
            >
              <SymmetryPicker
                symmetryMode={symmetryMode ?? 'none'}
                onPick={(mode) => { setSymmetryMode(mode); setIsSymmetryOpen(false); }}
              />
            </Popover>
          </>
        )}
        {setWrapMode != null && (
          <>
            <ToolbarButton
              icon={WrapIcon}
              size="sm"
              onClick={() => setWrapMode(!wrapMode)}
              selected={wrapMode}
              aria-label="Wrap mode"
              tooltip={{ content: 'Wrap', placement: 'bottom' }}
            />
          </>
        )}
        {setAlphaLock != null && (
          <>
            <ToolbarButton
              icon={PaintInsideIcon}
              size="sm"
              onClick={() => setAlphaLock(!alphaLock)}
              selected={alphaLock}
              aria-label="Alpha lock"
              tooltip={{ content: 'Paint inside', placement: 'bottom' }}
            />
          </>
        )}
        <span className={styles.titleDivider} aria-hidden="true" />
        <ToolbarButton
          icon={BackIcon}
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          tooltip={{ content: 'Undo (Cmd+Z)', placement: 'bottom' }}
        />
        <ToolbarButton
          icon={ForwardIcon}
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          tooltip={{ content: 'Redo (Cmd+Shift+Z)', placement: 'bottom' }}
        />
      </div>
    </FloatingPanel>
  );
};

export default TitlePanel;
