import React from 'react';
import FloatingPanel from '@/primitives/FloatingPanel';
import AlphaLockControl from '@/editor/controls/AlphaLockControl';
import CanvasSizePicker from '@/editor/controls/CanvasSizePicker';
import DrawingTitleControl from '@/editor/controls/DrawingTitleControl';
import HistoryRedoControl from '@/editor/controls/HistoryRedoControl';
import HistoryUndoControl from '@/editor/controls/HistoryUndoControl';
import ToolGroupCluster from '@/editor/controls/ToolGroupCluster';
import ToolGroupClusterDivider from '@/editor/controls/ToolGroupClusterDivider';
import SymmetryControl from '@/editor/controls/SymmetryControl';
import TilingPreviewControl from '@/editor/controls/TilingPreviewControl';
import WrapModeControl from '@/editor/controls/WrapModeControl';
import ZoomControls from '@/editor/controls/ZoomControls/ZoomControls';
import type { SymmetryMode } from '../lib/symmetry';
import type { UseViewportReturn } from '../hooks/useViewport';

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

  return (
    <FloatingPanel position="top-center" size="sm" aria-label="Drawing title">
      <ToolGroupCluster>
        <DrawingTitleControl title={title} onTitleChange={onTitleChange} />
        {showSizePicker && (
          <>
            <ToolGroupClusterDivider />
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
            <ToolGroupClusterDivider />
            <ZoomControls viewport={viewport} />
          </>
        )}
        {setTilingEnabled != null && (
          <TilingPreviewControl tilingEnabled={tilingEnabled ?? false} setTilingEnabled={setTilingEnabled} />
        )}
        {setSymmetryMode != null && (
          <>
            <ToolGroupClusterDivider />
            <SymmetryControl symmetryMode={symmetryMode ?? 'none'} setSymmetryMode={setSymmetryMode} />
          </>
        )}
        {setWrapMode != null && <WrapModeControl wrapMode={wrapMode ?? false} setWrapMode={setWrapMode} />}
        {setAlphaLock != null && (
          <AlphaLockControl alphaLock={alphaLock ?? false} setAlphaLock={setAlphaLock} />
        )}
        <ToolGroupClusterDivider />
        <HistoryUndoControl canUndo={canUndo} onUndo={onUndo} />
        <HistoryRedoControl canRedo={canRedo} onRedo={onRedo} />
      </ToolGroupCluster>
    </FloatingPanel>
  );
};

export default TitlePanel;
