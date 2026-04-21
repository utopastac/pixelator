import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditorManagedSize } from './useEditorManagedSize';

describe('useEditorManagedSize', () => {
  describe('sizesEnabled', () => {
    it('is false when sizes is omitted', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16 }),
      );
      expect(result.current.sizesEnabled).toBe(false);
    });

    it('is false when sizes is an empty array', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16, sizes: [] }),
      );
      expect(result.current.sizesEnabled).toBe(false);
    });

    it('is true when sizes has entries', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16, sizes: [16, 32, 64] }),
      );
      expect(result.current.sizesEnabled).toBe(true);
    });
  });

  describe('width / height passthrough when sizesEnabled is false', () => {
    it('width and height reflect widthProp and heightProp', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 24, heightProp: 36 }),
      );
      expect(result.current.width).toBe(24);
      expect(result.current.height).toBe(36);
    });

    it('managedWidth and managedHeight are seeded from props but ignored for width/height output', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 24, heightProp: 36 }),
      );
      // managedWidth/managedHeight are seeded from props on mount
      expect(result.current.managedWidth).toBe(24);
      expect(result.current.managedHeight).toBe(36);
      // but width/height come from the props directly, not managed state
      expect(result.current.width).toBe(24);
      expect(result.current.height).toBe(36);
    });
  });

  describe('width / height when sizesEnabled is true', () => {
    it('width and height are seeded from widthProp / heightProp on mount', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 32, heightProp: 48, sizes: [32, 64] }),
      );
      expect(result.current.width).toBe(32);
      expect(result.current.height).toBe(48);
    });

    it('width and height track managedWidth / managedHeight', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 32, heightProp: 48, sizes: [32, 64] }),
      );
      act(() => result.current.setManagedWidth(64));
      act(() => result.current.setManagedHeight(64));
      expect(result.current.width).toBe(64);
      expect(result.current.height).toBe(64);
    });
  });

  describe('handleHistorySizeChange', () => {
    it('updates managedWidth and managedHeight when sizesEnabled is true', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16, sizes: [16, 32] }),
      );
      act(() => result.current.handleHistorySizeChange(32, 32));
      expect(result.current.managedWidth).toBe(32);
      expect(result.current.managedHeight).toBe(32);
    });

    it('does not update managedWidth or managedHeight when sizesEnabled is false', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16 }),
      );
      act(() => result.current.handleHistorySizeChange(64, 64));
      expect(result.current.managedWidth).toBe(16);
      expect(result.current.managedHeight).toBe(16);
    });

    it('calls onSizeChange when sizesEnabled is true', () => {
      const onSizeChange = vi.fn();
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16, sizes: [16, 32], onSizeChange }),
      );
      act(() => result.current.handleHistorySizeChange(32, 32));
      expect(onSizeChange).toHaveBeenCalledOnce();
      expect(onSizeChange).toHaveBeenCalledWith(32, 32);
    });

    it('calls onSizeChange when sizesEnabled is false', () => {
      const onSizeChange = vi.fn();
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16, onSizeChange }),
      );
      act(() => result.current.handleHistorySizeChange(32, 32));
      expect(onSizeChange).toHaveBeenCalledOnce();
      expect(onSizeChange).toHaveBeenCalledWith(32, 32);
    });

    it('does not crash when onSizeChange is omitted', () => {
      const { result } = renderHook(() =>
        useEditorManagedSize({ widthProp: 16, heightProp: 16, sizes: [16, 32] }),
      );
      expect(() => {
        act(() => result.current.handleHistorySizeChange(32, 32));
      }).not.toThrow();
    });
  });
});
