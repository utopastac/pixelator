import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import AlphaLockControl from '@/editor/controls/AlphaLockControl';
import BrushSizeControl from '@/editor/controls/BrushSizeControl';
import CanvasSizePicker from '@/editor/controls/CanvasSizePicker';
import DrawingTitleControl from '@/editor/controls/DrawingTitleControl';
import DrawingsPanelToggleControl from '@/editor/controls/DrawingsPanelToggleControl';
import EraserToolControl from '@/editor/controls/EraserToolControl';
import EyedropperToolControl from '@/editor/controls/EyedropperToolControl';
import FillToolControl from '@/editor/controls/FillToolControl';
import GridOverlayControl from '@/editor/controls/GridOverlayControl';
import HistoryRedoControl from '@/editor/controls/HistoryRedoControl';
import HistoryUndoControl from '@/editor/controls/HistoryUndoControl';
import KeyboardShortcutsControl from '@/editor/controls/KeyboardShortcutsControl';
import LineToolControl from '@/editor/controls/LineToolControl';
import MarqueeControl from '@/editor/controls/MarqueeControl';
import MoveToolControl from '@/editor/controls/MoveToolControl';
import PaintToolControl from '@/editor/controls/PaintToolControl';
import PanelsVisibilityControl from '@/editor/controls/PanelsVisibilityControl';
import PenToolControl from '@/editor/controls/PenToolControl';
import ShapeControl from '@/editor/controls/ShapeControl';
import SwatchesPopoverControl from '@/editor/controls/SwatchesPopoverControl';
import SymmetryControl from '@/editor/controls/SymmetryControl';
import ThemeToggleControl from '@/editor/controls/ThemeToggleControl';
import TilingPreviewControl from '@/editor/controls/TilingPreviewControl';
import WrapModeControl from '@/editor/controls/WrapModeControl';
import ZoomControls from '@/editor/controls/ZoomControls/ZoomControls';
import type { SymmetryMode } from '@/editor/lib/symmetry';
import type { UseViewportReturn } from '@/editor/hooks/useViewport';
import type { Theme } from '@/hooks/useTheme';

/** Swatches + palette row inputs (no popover state). */
export interface EditorToolsPaletteProps {
  palette: string[];
  paletteId?: string;
  onPaletteChange?: (id: string) => void;
  customColors: string[];
  onAddCustomColor?: (color: string) => void;
}

/** @deprecated Use `EditorToolsPaletteProps`. */
export type MainToolsRowProps = EditorToolsPaletteProps;

/** Optional top-cluster fields — omit when there is no drawing title chrome. */
export interface EditorControlsWiring {
  title: string;
  onTitleChange: (next: string) => void;
  sizes?: number[];
  currentWidth?: number;
  currentHeight?: number;
  onPickSize?: (width: number, height: number) => void;
  viewport?: Pick<UseViewportReturn, 'zoom' | 'setZoom' | 'fit' | 'isAutoFit'>;
  tilingEnabled?: boolean;
  setTilingEnabled?: (v: boolean) => void;
  wrapMode?: boolean;
  setWrapMode?: (v: boolean) => void;
  symmetryMode?: SymmetryMode;
  setSymmetryMode?: (mode: SymmetryMode) => void;
  alphaLock?: boolean;
  setAlphaLock?: (v: boolean) => void;
  gridOverlayVisible?: boolean;
  setGridOverlayVisible?: (v: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/** App-level chrome wired through the editor (help cluster, drawings toggle, …). */
export interface EditorHelpControlsWiring {
  /** Current panel visibility — drives hide/show icon. */
  panelsVisible?: boolean;
  onTogglePanels?: () => void;
  /** Drawings gallery open — drives menu vs close icon. */
  drawingsPanelOpen?: boolean;
  onToggleDrawingsPanel?: () => void;
  theme?: Theme;
  onThemeToggle?: () => void;
  onOpenShortcuts?: () => void;
}

/** Data from the editor hook (palette + optional title cluster). No tool-popover state. */
export type EditorChromeData = EditorToolsPaletteProps &
  Partial<EditorControlsWiring> &
  Partial<EditorHelpControlsWiring>;

/** Popover / anchor state owned by `EditorBars`, passed through to each tool node. */
export interface EditorToolPopoverInput {
  isBrushPopoverOpen: boolean;
  setBrushPopoverOpen: Dispatch<SetStateAction<boolean>>;
  brushSizeAnchorRef: RefObject<HTMLDivElement | null>;
  isShapePopoverOpen: boolean;
  setShapePopoverOpen: Dispatch<SetStateAction<boolean>>;
  shapeAnchorRef: RefObject<HTMLDivElement | null>;
  isMarqueePopoverOpen: boolean;
  setMarqueePopoverOpen: Dispatch<SetStateAction<boolean>>;
  marqueeAnchorRef: RefObject<HTMLDivElement | null>;
  closeAllToolPopovers: () => void;
  openBrushSizePopover: () => void;
  openShapePopover: () => void;
  openMarqueePopover: () => void;
  shapesShortPress: () => void;
  onBrushButtonPress: () => void;
}

export type EditorChromeInput = EditorChromeData & EditorToolPopoverInput;

/** Every pre-wired chrome node — compose in any order inside your bar JSX. */
export type EditorControlNodes = {
  drawingTitle: ReactNode | null;
  canvasSize: ReactNode | null;
  zoom: ReactNode | null;
  gridOverlay: ReactNode | null;
  tiling: ReactNode | null;
  symmetry: ReactNode | null;
  wrap: ReactNode | null;
  alphaLock: ReactNode | null;
  historyUndo: ReactNode | null;
  historyRedo: ReactNode | null;
  moveTool: ReactNode;
  marquee: ReactNode;
  brushSize: ReactNode;
  paint: ReactNode;
  pen: ReactNode;
  line: ReactNode;
  shape: ReactNode;
  eraser: ReactNode;
  fill: ReactNode;
  eyedropper: ReactNode;
  swatches: ReactNode;
  togglePanels: ReactNode | null;
  keyboardShortcuts: ReactNode | null;
  themeToggle: ReactNode | null;
  openDrawings: ReactNode | null;
};

/**
 * Returns one React element per editor chrome control (title cluster + each tool).
 * Pass popover state/callbacks from the component that renders the bar (e.g. `EditorBars`).
 */
export function createEditorControls(p: EditorChromeInput): EditorControlNodes {
  const showSizePicker = Array.isArray(p.sizes) && p.sizes.length > 0;
  const showTitleCluster = typeof p.title === 'string' && typeof p.onTitleChange === 'function';
  const t = showTitleCluster ? (p as EditorControlsWiring) : null;

  const titleBlock: Pick<
    EditorControlNodes,
    | 'drawingTitle'
    | 'canvasSize'
    | 'zoom'
    | 'gridOverlay'
    | 'tiling'
    | 'symmetry'
    | 'wrap'
    | 'alphaLock'
    | 'historyUndo'
    | 'historyRedo'
  > = t
    ? {
        drawingTitle: <DrawingTitleControl title={t.title} onTitleChange={t.onTitleChange} />,
        canvasSize:
          showSizePicker && t.onPickSize != null ? (
            <CanvasSizePicker
              sizes={t.sizes!}
              currentWidth={t.currentWidth}
              currentHeight={t.currentHeight}
              onPickSize={t.onPickSize}
            />
          ) : null,
        zoom: t.viewport ? <ZoomControls viewport={t.viewport} /> : null,
        gridOverlay:
          t.setGridOverlayVisible != null ? (
            <GridOverlayControl
              gridOverlayVisible={t.gridOverlayVisible ?? true}
              setGridOverlayVisible={t.setGridOverlayVisible}
            />
          ) : null,
        tiling:
          t.setTilingEnabled != null ? (
            <TilingPreviewControl tilingEnabled={t.tilingEnabled ?? false} setTilingEnabled={t.setTilingEnabled} />
          ) : null,
        symmetry:
          t.setSymmetryMode != null ? (
            <SymmetryControl symmetryMode={t.symmetryMode ?? 'none'} setSymmetryMode={t.setSymmetryMode} />
          ) : null,
        wrap:
          t.setWrapMode != null ? <WrapModeControl wrapMode={t.wrapMode ?? false} setWrapMode={t.setWrapMode} /> : null,
        alphaLock:
          t.setAlphaLock != null ? (
            <AlphaLockControl alphaLock={t.alphaLock ?? false} setAlphaLock={t.setAlphaLock} />
          ) : null,
        historyUndo: <HistoryUndoControl canUndo={t.canUndo} onUndo={t.onUndo} />,
        historyRedo: <HistoryRedoControl canRedo={t.canRedo} onRedo={t.onRedo} />,
      }
    : {
        drawingTitle: null,
        canvasSize: null,
        zoom: null,
        gridOverlay: null,
        tiling: null,
        symmetry: null,
        wrap: null,
        alphaLock: null,
        historyUndo: null,
        historyRedo: null,
      };

  const fill = <FillToolControl onClosePopovers={p.closeAllToolPopovers} />;

  const eyedropper = <EyedropperToolControl onClosePopovers={p.closeAllToolPopovers} />;

  const swatches = (
    <SwatchesPopoverControl
      palette={p.palette}
      paletteId={p.paletteId}
      onPaletteChange={p.onPaletteChange}
      customColors={p.customColors}
      onAddCustomColor={p.onAddCustomColor}
    />
  );

  const togglePanels =
    typeof p.panelsVisible === 'boolean' && p.onTogglePanels != null ? (
      <PanelsVisibilityControl panelsVisible={p.panelsVisible} onTogglePanels={p.onTogglePanels} />
    ) : null;

  const keyboardShortcuts =
    p.onOpenShortcuts != null ? <KeyboardShortcutsControl onOpenShortcuts={p.onOpenShortcuts} /> : null;

  const themeToggle =
    p.theme != null && p.onThemeToggle != null ? (
      <ThemeToggleControl theme={p.theme} onThemeToggle={p.onThemeToggle} />
    ) : null;

  const openDrawings =
    typeof p.drawingsPanelOpen === 'boolean' && p.onToggleDrawingsPanel != null ? (
      <DrawingsPanelToggleControl
        drawingsPanelOpen={p.drawingsPanelOpen}
        onToggleDrawingsPanel={p.onToggleDrawingsPanel}
      />
    ) : null;

  return {
    ...titleBlock,
    moveTool: <MoveToolControl onClosePopovers={p.closeAllToolPopovers} />,
    marquee: (
      <MarqueeControl
        isOpen={p.isMarqueePopoverOpen}
        setIsOpen={p.setMarqueePopoverOpen}
        onOpenMarqueeOptions={p.openMarqueePopover}
        anchorRef={p.marqueeAnchorRef}
        onClosePopovers={p.closeAllToolPopovers}
      />
    ),
    brushSize: (
      <BrushSizeControl
        isOpen={p.isBrushPopoverOpen}
        onButtonPress={p.onBrushButtonPress}
        onClose={() => p.setBrushPopoverOpen(false)}
        anchorRef={p.brushSizeAnchorRef}
      />
    ),
    paint: <PaintToolControl onClosePopovers={p.closeAllToolPopovers} />,
    pen: <PenToolControl onClosePopovers={p.closeAllToolPopovers} />,
    line: <LineToolControl onClosePopovers={p.closeAllToolPopovers} />,
    shape: (
      <ShapeControl
        isOpen={p.isShapePopoverOpen}
        setIsOpen={p.setShapePopoverOpen}
        onOpenShapeOptions={p.openShapePopover}
        onShortPress={p.shapesShortPress}
        anchorRef={p.shapeAnchorRef}
      />
    ),
    eraser: <EraserToolControl onClosePopovers={p.closeAllToolPopovers} />,
    fill,
    eyedropper,
    swatches,
    togglePanels,
    keyboardShortcuts,
    themeToggle,
    openDrawings,
  };
}
