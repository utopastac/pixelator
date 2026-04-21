import { useState, useCallback } from 'react';
import { buildCanvasContextMenuItems, type CanvasContextMenuDeps } from '../canvasContextMenuItems';
import { hasClip } from '@/lib/clipboard';

type UseEditorContextMenuArgs = Omit<CanvasContextMenuDeps, 'close' | 'hasClip'>;

export function useEditorContextMenu(args: UseEditorContextMenuArgs) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const close = useCallback(() => setContextMenu(null), []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const items = buildCanvasContextMenuItems({ ...args, close, hasClip: hasClip() });

  return {
    onContextMenu,
    contextMenuProps: {
      open: contextMenu !== null,
      position: contextMenu ?? undefined,
      onClose: close,
      items,
    },
  };
}
