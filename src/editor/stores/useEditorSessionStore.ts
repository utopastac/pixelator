import { create } from 'zustand';
import type { PixelArtTool } from '@/editor/PixelArtEditor';
import type { PixelArtBrushSize, PixelArtFillMode } from '@/editor/lib/pixelArtUtils';
import type { SymmetryMode } from '@/editor/lib/symmetry';

export type ShapeTool = 'rect' | 'circle' | 'triangle' | 'star' | 'arrow';
export type MarqueeShape = 'rect' | 'ellipse' | 'wand' | 'polygon';

const noop = () => {};

const applyFill = (
  prev: PixelArtFillMode,
  next: PixelArtFillMode | ((p: PixelArtFillMode) => PixelArtFillMode),
) => (typeof next === 'function' ? (next as (p: PixelArtFillMode) => PixelArtFillMode)(prev) : next);

export interface EditorSessionStore {
  activeTool: PixelArtTool;
  brushSize: PixelArtBrushSize;
  lastShape: ShapeTool;
  rectFillMode: PixelArtFillMode;
  circleFillMode: PixelArtFillMode;
  triangleFillMode: PixelArtFillMode;
  starFillMode: PixelArtFillMode;
  arrowFillMode: PixelArtFillMode;
  activeColor: string;
  independentHue: number | null;
  marqueeShape: MarqueeShape;
  symmetryMode: SymmetryMode;
  tilingEnabled: boolean;
  wrapMode: boolean;
  alphaLock: boolean;
  cancelPenPath: () => void;
  setActiveTool: (tool: PixelArtTool | ((prev: PixelArtTool) => PixelArtTool)) => void;
  setBrushSize: (size: PixelArtBrushSize | ((prev: PixelArtBrushSize) => PixelArtBrushSize)) => void;
  setLastShape: (shape: ShapeTool | ((prev: ShapeTool) => ShapeTool)) => void;
  setRectFillMode: (mode: PixelArtFillMode | ((prev: PixelArtFillMode) => PixelArtFillMode)) => void;
  setCircleFillMode: (mode: PixelArtFillMode | ((prev: PixelArtFillMode) => PixelArtFillMode)) => void;
  setTriangleFillMode: (mode: PixelArtFillMode | ((prev: PixelArtFillMode) => PixelArtFillMode)) => void;
  setStarFillMode: (mode: PixelArtFillMode | ((prev: PixelArtFillMode) => PixelArtFillMode)) => void;
  setArrowFillMode: (mode: PixelArtFillMode | ((prev: PixelArtFillMode) => PixelArtFillMode)) => void;
  setActiveColor: (color: string) => void;
  setIndependentHue: (hue: number | null) => void;
  setMarqueeShape: (shape: MarqueeShape | ((prev: MarqueeShape) => MarqueeShape)) => void;
  setSymmetryMode: (mode: SymmetryMode) => void;
  setTilingEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setWrapMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAlphaLock: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setCancelPenPath: (fn: () => void) => void;
  resetSession: (initialColor: string) => void;
}

export const useEditorSessionStore = create<EditorSessionStore>((set) => ({
  activeTool: 'paint',
  brushSize: 'sm',
  lastShape: 'rect',
  rectFillMode: 'outline',
  circleFillMode: 'outline',
  triangleFillMode: 'outline',
  starFillMode: 'outline',
  arrowFillMode: 'outline',
  activeColor: '#000000',
  independentHue: null,
  marqueeShape: 'rect',
  symmetryMode: 'none',
  tilingEnabled: false,
  wrapMode: false,
  alphaLock: false,
  cancelPenPath: noop,

  setActiveTool: (tool) =>
    set((s) => ({
      activeTool: typeof tool === 'function' ? (tool as (p: PixelArtTool) => PixelArtTool)(s.activeTool) : tool,
    })),
  setBrushSize: (brushSize) =>
    set((s) => ({
      brushSize:
        typeof brushSize === 'function'
          ? (brushSize as (p: PixelArtBrushSize) => PixelArtBrushSize)(s.brushSize)
          : brushSize,
    })),
  setLastShape: (lastShape) =>
    set((s) => ({
      lastShape:
        typeof lastShape === 'function' ? (lastShape as (p: ShapeTool) => ShapeTool)(s.lastShape) : lastShape,
    })),
  setRectFillMode: (rectFillMode) =>
    set((s) => ({ rectFillMode: applyFill(s.rectFillMode, rectFillMode) })),
  setCircleFillMode: (circleFillMode) =>
    set((s) => ({ circleFillMode: applyFill(s.circleFillMode, circleFillMode) })),
  setTriangleFillMode: (triangleFillMode) =>
    set((s) => ({ triangleFillMode: applyFill(s.triangleFillMode, triangleFillMode) })),
  setStarFillMode: (starFillMode) =>
    set((s) => ({ starFillMode: applyFill(s.starFillMode, starFillMode) })),
  setArrowFillMode: (arrowFillMode) =>
    set((s) => ({ arrowFillMode: applyFill(s.arrowFillMode, arrowFillMode) })),
  setActiveColor: (activeColor) => set({ activeColor }),
  setIndependentHue: (independentHue) => set({ independentHue }),
  setMarqueeShape: (marqueeShape) =>
    set((s) => ({
      marqueeShape:
        typeof marqueeShape === 'function'
          ? (marqueeShape as (p: MarqueeShape) => MarqueeShape)(s.marqueeShape)
          : marqueeShape,
    })),
  setSymmetryMode: (symmetryMode) => set({ symmetryMode }),
  setTilingEnabled: (tilingEnabled) =>
    set((s) => ({
      tilingEnabled:
        typeof tilingEnabled === 'function'
          ? (tilingEnabled as (p: boolean) => boolean)(s.tilingEnabled)
          : tilingEnabled,
    })),
  setWrapMode: (wrapMode) =>
    set((s) => ({
      wrapMode: typeof wrapMode === 'function' ? (wrapMode as (p: boolean) => boolean)(s.wrapMode) : wrapMode,
    })),
  setAlphaLock: (alphaLock) =>
    set((s) => ({
      alphaLock: typeof alphaLock === 'function' ? (alphaLock as (p: boolean) => boolean)(s.alphaLock) : alphaLock,
    })),
  setCancelPenPath: (fn) => set({ cancelPenPath: fn }),

  resetSession: (initialColor) =>
    set((s) => ({
      activeTool: 'paint',
      brushSize: 'sm',
      lastShape: 'rect',
      rectFillMode: 'outline',
      circleFillMode: 'outline',
      triangleFillMode: 'outline',
      starFillMode: 'outline',
      arrowFillMode: 'outline',
      activeColor: initialColor,
      independentHue: null,
      marqueeShape: 'rect',
      symmetryMode: 'none',
      tilingEnabled: false,
      wrapMode: false,
      alphaLock: false,
      cancelPenPath: s.cancelPenPath,
    })),
}));
