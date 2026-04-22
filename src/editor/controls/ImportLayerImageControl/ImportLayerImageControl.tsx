import { useRef } from 'react';
import ToolbarButton from '@/primitives/ToolbarButton';
import { ImageIcon } from '@/editor/icons/PixelToolIcons';
import { importImageAsPixels, layerNameFromFile } from '@/lib/imageImport';
import styles from './ImportLayerImageControl.module.css';

const READ_ERROR = 'Could not read that file';

export interface ImportLayerImageControlProps {
  canvasWidth: number;
  canvasHeight: number;
  onImportLayerImage: (pixels: string[], name?: string) => void;
  onImportFileReadError?: (message: string) => void;
}

export default function ImportLayerImageControl({
  canvasWidth,
  canvasHeight,
  onImportLayerImage,
  onImportFileReadError,
}: ImportLayerImageControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const pixels = await importImageAsPixels(file, canvasWidth, canvasHeight);
      onImportLayerImage(pixels, layerNameFromFile(file));
    } catch {
      onImportFileReadError?.(READ_ERROR);
    }
  };

  return (
    <div className={styles.root}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleChange}
      />
      <ToolbarButton
        icon={ImageIcon}
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Import image as layer"
        tooltip={{ content: 'Import image', placement: 'bottom' }}
        data-testid="import-layer-image"
      />
    </div>
  );
}
