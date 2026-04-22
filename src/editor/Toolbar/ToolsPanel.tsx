import React from 'react';
import FloatingPanel from '@/primitives/FloatingPanel';
import MainToolsRow, { type MainToolsRowProps } from '@/editor/controls/MainToolsRow';

export type ToolsPanelProps = MainToolsRowProps;

/** Tools cluster: selection, stroke tools, shapes, fill, eyedropper, swatches. */
const ToolsPanel: React.FC<ToolsPanelProps> = (props) => (
  <FloatingPanel role="toolbar" aria-label="Pixel art tools">
    <MainToolsRow {...props} showColorControls />
  </FloatingPanel>
);

export default ToolsPanel;
