import React from 'react';
import Popover from '@/overlays/Popover';
import MarqueePicker from '@/editor/controls/MarqueePicker';
import ToolButton from '@/editor/controls/ToolButton';
import {
  CircleMarqueeIcon,
  MagicWandIcon,
  PolygonSelectIcon,
  RectMarqueeIcon,
} from '@/editor/icons/PixelToolIcons';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

export interface MarqueeControlProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onOpenMarqueeOptions: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onClosePopovers: () => void;
}

export default function MarqueeControl({
  isOpen,
  setIsOpen,
  onOpenMarqueeOptions,
  anchorRef,
  onClosePopovers,
}: MarqueeControlProps) {
  const activeTool = useEditorSessionStore((s) => s.activeTool);
  const marqueeShape = useEditorSessionStore((s) => s.marqueeShape);
  const setMarqueeShape = useEditorSessionStore((s) => s.setMarqueeShape);
  const setActiveTool = useEditorSessionStore((s) => s.setActiveTool);
  const cancelPenPath = useEditorSessionStore((s) => s.cancelPenPath);

  const Icon =
    marqueeShape === 'ellipse'
      ? CircleMarqueeIcon
      : marqueeShape === 'wand'
        ? MagicWandIcon
        : marqueeShape === 'polygon'
          ? PolygonSelectIcon
          : RectMarqueeIcon;

  return (
    <>
      <ToolButton
        ref={anchorRef}
        icon={Icon}
        size="md"
        selected={activeTool === 'marquee'}
        onPress={() => {
          cancelPenPath();
          setActiveTool('marquee');
          onClosePopovers();
        }}
        aria-label="Marquee selection"
        tooltip="Marquee selection"
        chevron={{
          onClick: onOpenMarqueeOptions,
          'aria-label': 'Marquee options',
          isOpen,
        }}
      />
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={anchorRef}
        offsetX={-5}
        role="dialog"
        aria-label="Selection mode"
      >
        <MarqueePicker
          marqueeShape={marqueeShape}
          onPick={(shape) => {
            setMarqueeShape(shape);
            setActiveTool('marquee');
            setIsOpen(false);
            cancelPenPath();
          }}
        />
      </Popover>
    </>
  );
}
