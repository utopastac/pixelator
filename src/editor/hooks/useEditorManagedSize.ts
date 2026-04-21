import { useState, useCallback } from 'react';

interface UseEditorManagedSizeProps {
  widthProp: number;
  heightProp: number;
  sizes?: number[];
  onSizeChange?: (w: number, h: number) => void;
}

interface UseEditorManagedSizeReturn {
  width: number;
  height: number;
  sizesEnabled: boolean;
  managedWidth: number;
  managedHeight: number;
  setManagedWidth: React.Dispatch<React.SetStateAction<number>>;
  setManagedHeight: React.Dispatch<React.SetStateAction<number>>;
  handleHistorySizeChange: (w: number, h: number) => void;
}

/**
 * Resolves the editor's effective canvas dimensions. When the `sizes` prop is
 * provided (an allowlist of valid grid sizes), the hook owns mutable
 * `managedWidth` / `managedHeight` state and mirrors changes back via
 * `onSizeChange`. Without `sizes`, the prop values are used directly and the
 * managed state is inert.
 */
export function useEditorManagedSize({
  widthProp,
  heightProp,
  sizes,
  onSizeChange,
}: UseEditorManagedSizeProps): UseEditorManagedSizeReturn {
  const sizesEnabled = Array.isArray(sizes) && sizes.length > 0;
  const [managedWidth, setManagedWidth] = useState<number>(widthProp);
  const [managedHeight, setManagedHeight] = useState<number>(heightProp);
  const width = sizesEnabled ? managedWidth : widthProp;
  const height = sizesEnabled ? managedHeight : heightProp;

  // Bridges history-driven dimension changes (undo/redo of a resize, or the
  // resize commit itself) back into managed-size state and the external
  // onSizeChange callback. Only mutates managed state in sizes-managed mode.
  const handleHistorySizeChange = useCallback(
    (nextWidth: number, nextHeight: number) => {
      if (sizesEnabled) {
        setManagedWidth(nextWidth);
        setManagedHeight(nextHeight);
      }
      onSizeChange?.(nextWidth, nextHeight);
    },
    [sizesEnabled, onSizeChange],
  );

  return {
    width,
    height,
    sizesEnabled,
    managedWidth,
    managedHeight,
    setManagedWidth,
    setManagedHeight,
    handleHistorySizeChange,
  };
}
