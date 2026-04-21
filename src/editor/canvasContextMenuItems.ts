import React from 'react';
import type { ContextMenuItem } from '@/overlays/ContextMenu';
import PngScalePicker from '@/chrome/PngScalePicker';
import {
  BackIcon,
  ForwardIcon,
  RectMarqueeIcon,
  EraserIcon,
  FillIcon,
  DuplicateIcon,
  TrashIcon,
  SvgIcon,
  PlusIcon,
  SelectAllIcon,
  FitToScreenIcon,
  RotateCWIcon,
  RotateCCWIcon,
  LayersIcon,
  ZoomIcon,
  CutIcon,
  CopyIcon,
  PasteIcon,
} from './icons/PixelToolIcons';
import type { PixelArtSelection } from './lib/pixelArtUtils';

/** Dependency bundle passed from `PixelArtEditor` into
 *  `buildCanvasContextMenuItems`. Keeps the component's JSX free of a giant
 *  inline items array, and keeps this builder pure (returns a fresh array
 *  each call — no hidden state).
 *
 *  `close()` is invoked by every action item at the end of its `onClick`
 *  handler so keyboard activation and click activation share the same close
 *  semantics without the caller having to remember.
 */
export interface CanvasContextMenuDeps {
  // Menu lifecycle.
  close: () => void;

  // History / viewport.
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  fit: () => void;
  setZoom: (zoom: number) => void;

  // Selection.
  selection: PixelArtSelection | null;
  setSelection: (s: PixelArtSelection | null) => void;
  selectionContainsCell: (col: number, row: number) => boolean;
  clearLiftedPixels: () => void;

  // Layers.
  addLayer: () => void;
  duplicateLayer: (id: string) => void;
  clearLayer: (id: string) => void;
  activeLayerId: string;

  // Grid.
  width: number;
  height: number;
  pixels: string[];
  activeColor: string;

  // Paint plumbing shared with keyboard shortcuts.
  allowCommitOrSignal: () => boolean;
  commitPixels: (next: string[]) => void;
  emitChange: (next: string[]) => void;

  // One-shot commands.
  handleRotate: (dir: 'cw' | 'ccw') => void;

  // Clipboard verbs — shared with keyboard shortcuts + paste listener.
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  /** Drives Paste's disabled state — module-level PixelClip presence. */
  hasClip: boolean;
  /** Drives Cut's disabled state — locked layers refuse destructive writes. */
  activeLayerLocked: boolean;

  // Downloads.
  downloadSvg: () => void;
  downloadPng: (scale?: number) => void;
  downloadLayersSvg: () => void;

  // Destructive reset.
  resetDrawing: () => void;

  // Select-all helper sets the marquee tool before applying the selection.
  setActiveTool: (tool: 'marquee') => void;
}

/**
 * Build the full items array for the canvas right-click menu. Pure — the
 * component calls it on every render with current state; the only reason
 * it lives in its own module is so `PixelArtEditor.tsx` doesn't need the
 * ~150-line inline definition plus its entourage of icon / picker imports.
 *
 * Selection-scoped items (Fill-selection, Deselect) are inserted
 * conditionally, so ordering stays stable whether a selection exists or not.
 */
export function buildCanvasContextMenuItems(deps: CanvasContextMenuDeps): ContextMenuItem[] {
  const {
    close,
    canUndo,
    canRedo,
    undo,
    redo,
    fit,
    setZoom,
    selection,
    setSelection,
    selectionContainsCell,
    clearLiftedPixels,
    addLayer,
    duplicateLayer,
    clearLayer,
    activeLayerId,
    width,
    height,
    pixels,
    activeColor,
    allowCommitOrSignal,
    commitPixels,
    emitChange,
    handleRotate,
    handleCopy,
    handleCut,
    handlePaste,
    hasClip,
    activeLayerLocked,
    downloadSvg,
    downloadPng,
    downloadLayersSvg,
    resetDrawing,
    setActiveTool,
  } = deps;

  const selectionItems: ContextMenuItem[] = selection
    ? [
        {
          label: 'Fill selection with colour',
          icon: FillIcon,
          onClick: () => {
            // Same rule as the Alt+Delete keyboard shortcut: iterate
            // selection bbox, paint active-colour into any cell the
            // selection contains.
            if (!allowCommitOrSignal()) {
              close();
              return;
            }
            const minX = Math.min(selection.x1, selection.x2);
            const maxX = Math.max(selection.x1, selection.x2);
            const minY = Math.min(selection.y1, selection.y2);
            const maxY = Math.max(selection.y1, selection.y2);
            const next = [...pixels];
            for (let row = minY; row <= maxY; row++) {
              for (let col = minX; col <= maxX; col++) {
                if (selectionContainsCell(col, row)) next[row * width + col] = activeColor;
              }
            }
            commitPixels(next);
            emitChange(next);
            close();
          },
        },
        {
          label: 'Deselect',
          icon: RectMarqueeIcon,
          onClick: () => {
            setSelection(null);
            clearLiftedPixels();
            close();
          },
        },
      ]
    : [];

  return [
    {
      label: 'Undo',
      icon: BackIcon,
      disabled: !canUndo,
      testId: 'canvas-menu-undo',
      onClick: () => { undo(); close(); },
    },
    {
      label: 'Redo',
      icon: ForwardIcon,
      disabled: !canRedo,
      testId: 'canvas-menu-redo',
      onClick: () => { redo(); close(); },
    },
    { separator: true, label: '' },
    {
      label: 'Fit to screen',
      icon: FitToScreenIcon,
      onClick: () => { fit(); close(); },
    },
    {
      label: 'Zoom to 100%',
      icon: ZoomIcon,
      onClick: () => { setZoom(1); close(); },
    },
    { separator: true, label: '' },
    {
      label: 'New layer',
      icon: PlusIcon,
      onClick: () => { addLayer(); close(); },
    },
    {
      label: 'Duplicate layer',
      icon: DuplicateIcon,
      onClick: () => { duplicateLayer(activeLayerId); close(); },
    },
    {
      label: 'Clear layer',
      icon: EraserIcon,
      testId: 'canvas-menu-clear-layer',
      onClick: () => { clearLayer(activeLayerId); close(); },
    },
    {
      label: selection ? 'Rotate selection 90° CW' : 'Rotate layer 90° CW',
      icon: RotateCWIcon,
      testId: 'canvas-menu-rotate-cw',
      onClick: () => { handleRotate('cw'); close(); },
    },
    {
      label: selection ? 'Rotate selection 90° CCW' : 'Rotate layer 90° CCW',
      icon: RotateCCWIcon,
      testId: 'canvas-menu-rotate-ccw',
      onClick: () => { handleRotate('ccw'); close(); },
    },
    { separator: true, label: '' },
    {
      label: 'Select all',
      icon: SelectAllIcon,
      testId: 'canvas-menu-select-all',
      onClick: () => {
        setActiveTool('marquee');
        setSelection({ shape: 'rect', x1: 0, y1: 0, x2: width - 1, y2: height - 1 });
        clearLiftedPixels();
        close();
      },
    },
    ...selectionItems,
    { separator: true, label: '' },
    {
      label: 'Cut',
      icon: CutIcon,
      disabled: !selection || activeLayerLocked,
      testId: 'canvas-menu-cut',
      onClick: () => { handleCut(); close(); },
    },
    {
      label: 'Copy',
      icon: CopyIcon,
      disabled: !selection,
      testId: 'canvas-menu-copy',
      onClick: () => { handleCopy(); close(); },
    },
    {
      label: 'Paste',
      icon: PasteIcon,
      disabled: !hasClip,
      testId: 'canvas-menu-paste',
      onClick: () => { handlePaste(); close(); },
    },
    { separator: true, label: '' },
    {
      label: 'Download SVG',
      icon: SvgIcon,
      onClick: () => { downloadSvg(); close(); },
    },
    {
      label: 'Download PNG',
      content: React.createElement(PngScalePicker, {
        width,
        height,
        onPick: (scale: number) => { downloadPng(scale); close(); },
      }),
    },
    {
      label: 'Download all layers (SVG)',
      icon: LayersIcon,
      onClick: () => { downloadLayersSvg(); close(); },
    },
    { separator: true, label: '' },
    {
      label: 'Reset drawing',
      icon: TrashIcon,
      variant: 'destructive' as const,
      onClick: () => {
        close();
        resetDrawing();
      },
    },
  ];
}
