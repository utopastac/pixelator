import React from 'react';
import { BRUSH_ICONS } from '@/editor/icons/PixelArtIcons';
import Popover from '@/overlays/Popover';
import BrushSizePicker from '@/editor/controls/BrushSizePicker';
import ToolButton from '@/editor/controls/ToolButton';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';
import type { PixelArtBrushSize } from '@/editor/lib/pixelArtUtils';

export interface BrushSizeControlProps {
  isOpen: boolean;
  onButtonPress: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

export default function BrushSizeControl({
  isOpen,
  onButtonPress,
  onClose,
  anchorRef,
}: BrushSizeControlProps) {
  const brushSize = useEditorSessionStore((s) => s.brushSize);
  const setBrushSize = useEditorSessionStore((s) => s.setBrushSize);

  return (
    <>
      <ToolButton
        ref={anchorRef}
        icon={BRUSH_ICONS[brushSize]}
        size="md"
        selected={isOpen}
        onPress={onButtonPress}
        aria-label="Brush size"
        tooltip="Brush size"
        hasOptions
        aria-haspopup="menu"
        aria-expanded={isOpen}
      />
      <Popover
        isOpen={isOpen}
        onClose={onClose}
        anchorRef={anchorRef}
        offsetX={-5}
        role="menu"
        aria-label="Brush size"
      >
        <BrushSizePicker
          brushSize={brushSize}
          onPick={(size: PixelArtBrushSize) => {
            setBrushSize(size);
            onClose();
          }}
        />
      </Popover>
    </>
  );
}
