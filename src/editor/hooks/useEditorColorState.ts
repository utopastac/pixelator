import { useState, useCallback } from 'react';
import type { PixelArtTool } from '../PixelArtEditor';
import type { PixelArtFillMode, PixelArtBrushSize } from '../lib/pixelArtUtils';
import { useRecentColors } from './useRecentColors';
import { useCustomColors } from './useCustomColors';

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
 * Fully uncontrolled — owns activeColor, customColors, and recentColors
 * internally via localStorage-backed hooks.
 *
 * `onColorCommit` is an optional callback fired once per stroke commit when
 * the colour is valid. The editor's own recent-colour list is updated
 * regardless of whether the callback is supplied.
 */
export function useEditorColorState({
  palette,
  commitPixels,
  onColorCommit,
}: UseEditorColorStateProps): UseEditorColorStateReturn {
  const [activeTool, setActiveTool] = useState<PixelArtTool>('paint');
  const [brushSize, setBrushSize] = useState<PixelArtBrushSize>('sm');
  const [lastShape, setLastShape] = useState<'rect' | 'circle' | 'triangle' | 'star' | 'arrow'>('rect');
  const [rectFillMode, setRectFillMode] = useState<PixelArtFillMode>('outline');
  const [circleFillMode, setCircleFillMode] = useState<PixelArtFillMode>('outline');
  const [triangleFillMode, setTriangleFillMode] = useState<PixelArtFillMode>('outline');
  const [starFillMode, setStarFillMode] = useState<PixelArtFillMode>('outline');
  const [arrowFillMode, setArrowFillMode] = useState<PixelArtFillMode>('outline');

  const { recents, pushRecent } = useRecentColors();

  const [activeColor, setActiveColorInternal] = useState<string>(() => recents[0] ?? palette[0] ?? '#000000');

  const [independentHue, setIndependentHue] = useState<number | null>(null);
  const { customColors, pushCustomColor, removeCustomColor } = useCustomColors();

  const setActiveColor = useCallback((c: string) => {
    setActiveColorInternal(c);
  }, []);

  const [marqueeShape, setMarqueeShape] = useState<'rect' | 'ellipse' | 'wand' | 'polygon'>('rect');

  const commitPixelsWithColor = useCallback(
    (px: string[], beforePixels?: string[]) => {
      commitPixels(px, beforePixels);
      if (activeTool === 'eraser') return;
      if (!/^#[0-9a-fA-F]{6}$/.test(activeColor)) return;
      pushRecent(activeColor);
      onColorCommit?.(activeColor);
    },
    [commitPixels, activeTool, activeColor, pushRecent, onColorCommit],
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
