import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { PixelArtTool } from '../PixelArtEditor';
import type { PixelArtFillMode, PixelArtBrushSize } from '../lib/pixelArtUtils';
import { useRecentColors } from './useRecentColors';
import { useCustomColors } from './useCustomColors';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

interface UseEditorColorStateProps {
  palette: string[];
  commitPixels: (px: string[], beforePixels?: string[]) => void;
  /** Callback fired once per stroke commit with the committed colour.
   *  When provided, recent-colour tracking is driven by this callback. */
  onColorCommit?: (color: string) => void;
}

interface UseEditorColorStateReturn {
  activeTool: PixelArtTool;
  setActiveTool: React.Dispatch<React.SetStateAction<PixelArtTool>>;
  brushSize: PixelArtBrushSize;
  setBrushSize: React.Dispatch<React.SetStateAction<PixelArtBrushSize>>;
  lastShape: 'rect' | 'circle' | 'triangle' | 'star' | 'arrow';
  setLastShape: React.Dispatch<React.SetStateAction<'rect' | 'circle' | 'triangle' | 'star' | 'arrow'>>;
  rectFillMode: PixelArtFillMode;
  setRectFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  circleFillMode: PixelArtFillMode;
  setCircleFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  triangleFillMode: PixelArtFillMode;
  setTriangleFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  starFillMode: PixelArtFillMode;
  setStarFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  arrowFillMode: PixelArtFillMode;
  setArrowFillMode: React.Dispatch<React.SetStateAction<PixelArtFillMode>>;
  activeColor: string;
  setActiveColor: (c: string) => void;
  independentHue: number | null;
  setIndependentHue: React.Dispatch<React.SetStateAction<number | null>>;
  /** localStorage-backed list of recent colours. */
  recents: string[];
  customColors: string[];
  pushCustomColor: (color: string) => void;
  removeCustomColor: (color: string) => void;
  marqueeShape: 'rect' | 'ellipse' | 'wand' | 'polygon';
  setMarqueeShape: React.Dispatch<React.SetStateAction<'rect' | 'ellipse' | 'wand' | 'polygon'>>;
  commitPixelsWithColor: (px: string[], beforePixels?: string[]) => void;
}

/**
 * Consolidates all tool + colour state for the editor into one hook.
 * Session fields live in `useEditorSessionStore`; this hook wires recents,
 * custom colours, and stroke commit behaviour.
 */
export function useEditorColorState({
  palette,
  commitPixels,
  onColorCommit,
}: UseEditorColorStateProps): UseEditorColorStateReturn {
  const { recents, pushRecent } = useRecentColors();
  const { customColors, pushCustomColor, removeCustomColor } = useCustomColors();

  const sessionSeededRef = useRef(false);
  if (!sessionSeededRef.current) {
    sessionSeededRef.current = true;
    useEditorSessionStore.getState().resetSession(recents[0] ?? palette[0] ?? '#000000');
  }

  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const brushSize = useEditorSessionStore((s) => s.brushSize);
  const setBrushSize = useEditorSessionStore((s) => s.setBrushSize);
  const lastShape = useEditorSessionStore((s) => s.lastShape);
  const setLastShape = useEditorSessionStore((s) => s.setLastShape);
  const rectFillMode = useEditorSessionStore((s) => s.rectFillMode);
  const setRectFillMode = useEditorSessionStore((s) => s.setRectFillMode);
  const circleFillMode = useEditorSessionStore((s) => s.circleFillMode);
  const setCircleFillMode = useEditorSessionStore((s) => s.setCircleFillMode);
  const triangleFillMode = useEditorSessionStore((s) => s.triangleFillMode);
  const setTriangleFillMode = useEditorSessionStore((s) => s.setTriangleFillMode);
  const starFillMode = useEditorSessionStore((s) => s.starFillMode);
  const setStarFillMode = useEditorSessionStore((s) => s.setStarFillMode);
  const arrowFillMode = useEditorSessionStore((s) => s.arrowFillMode);
  const setArrowFillMode = useEditorSessionStore((s) => s.setArrowFillMode);
  const activeColor = useEditorSessionStore((s) => s.activeColor);
  const setActiveColorInternal = useEditorSessionStore((s) => s.setActiveColor);
  const independentHue = useEditorSessionStore((s) => s.independentHue);
  const setIndependentHueStore = useEditorSessionStore((s) => s.setIndependentHue);
  const setIndependentHue: Dispatch<SetStateAction<number | null>> = useCallback(
    (value) => {
      const next =
        typeof value === 'function'
          ? (value as (prev: number | null) => number | null)(useEditorSessionStore.getState().independentHue)
          : value;
      setIndependentHueStore(next);
    },
    [setIndependentHueStore],
  );
  const marqueeShape = useEditorSessionStore((s) => s.marqueeShape);
  const setMarqueeShape = useEditorSessionStore((s) => s.setMarqueeShape);

  const setActiveColor = useCallback((c: string) => {
    setActiveColorInternal(c);
  }, [setActiveColorInternal]);

  const commitPixelsWithColor = useCallback(
    (px: string[], beforePixels?: string[]) => {
      commitPixels(px, beforePixels);
      const { activeTool: tool, activeColor: color } = useEditorSessionStore.getState();
      if (tool === 'eraser') return;
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
      pushRecent(color);
      onColorCommit?.(color);
    },
    [commitPixels, pushRecent, onColorCommit],
  );

  return {
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    lastShape,
    setLastShape,
    rectFillMode,
    setRectFillMode,
    circleFillMode,
    setCircleFillMode,
    triangleFillMode,
    setTriangleFillMode,
    starFillMode,
    setStarFillMode,
    arrowFillMode,
    setArrowFillMode,
    activeColor,
    setActiveColor,
    independentHue,
    setIndependentHue,
    recents,
    customColors,
    pushCustomColor,
    removeCustomColor,
    marqueeShape,
    setMarqueeShape,
    commitPixelsWithColor,
  };
}
