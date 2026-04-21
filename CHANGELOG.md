# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.9.0] – 2026-04-20

### Added
- JSDoc comments on all public API surfaces (props interface, hooks, primitives).
- README documenting the project, data model, and development scripts.

### Changed
- Extracted five additional subsystems from `PixelArtEditor` into focused hooks
  (`useEditorColorState`, `useEditorManagedSize`, `useEditorFileHandlers`,
  `useEditorCanvasSetup`, `useEditorCommands`), each with a corresponding unit-test file.
- Toolbar panels fully decomposed: `PixelArtToolbar` shell removed; `ToolsPanel`,
  `UtilitiesPanel`, and `TitlePanel` are each independent components.
- `UtilitiesPanel` portal / floating branches deduplicated; `pillEdge` layout
  system removed.
- Layers list auto-scrolls during drag-to-reorder; drop-indicator math corrected
  for scrolled lists.
- Shortcuts dialog reflows into a multi-column layout; Clipboard group added.
- `PixelArtEditor` relocated to `src/editor/` with subfolders for toolbar,
  layers panel, zoom controls, hooks, lib, and icons.

### Fixed
- Unnecessary `useCallback` wrappers and dead CSS removed from `App`.
- Drop-indicator position off by one when layers list is scrolled.

## [0.8.0] – 2026-04-20

### Added
- Unit tests for `useLayerTransform` and `useMoveTransformTool` (+additional
  event-handler hook tests, ~62 new cases).
- `ShortcutsDialog` listing all keyboard shortcuts with styled `<Kbd>` chips.
- `ConfirmDialog` primitive (portal, Escape / backdrop cancel, destructive variant).
- Clipboard: Cut / Copy / Paste for the active-layer selection, with icon assets.
- "Reset app", "Export Pixelator file", and "Import" / "Export all" backup flows.
- `Button` `destructive` variant.
- First-launch state seeded via `loadInitialState`.

### Changed
- `window.confirm()` replaced by `ConfirmDialog` throughout.
- Canvas context-menu items and one-shot editor commands extracted into
  `canvasContextMenuItems.ts` and `useEditorCommands.ts`.
- `extraLayersUtilities` prop renamed to `helpUtilities`; `FloatingPanel` gains
  `bottom-left` and `bottom-right` positions.

## [0.7.0] – 2026-04-19

### Added
- Move tool: affine transform frame (translate, uniform scale, edge stretch, rotate)
  rendered on the overlay canvas; handles hit-tested in screen space.
- Layer-level rotate (90° CW/CCW), confined to selection bbox when active.
- Grip-only drag handle on layer rows so the row click-target and reorder-handle
  are separate; drop-indicator math corrected.
- Stable `data-testid` attributes across all interactive components.
- Playwright E2E smoke tests (cold boot, persistence, corrupt-storage recovery,
  unknown deep-link id, SVG export).
- Pixel-art icon set (VT323 font, duplicate / trash / move / PNG / SVG icons).
- `ReadoutButton` primitive; solo-visibility for layers.

### Fixed
- Undo after Move-tool transform commit: active layer is now hidden via the
  compositor's `skipLayerId` during a pending transform, preserving the
  pre-transform pixels as the undo snapshot.
- Zoom performance: wheel / trackpad events coalesced into one `requestAnimationFrame`
  update per frame rather than one `setState` per event.

## [0.6.0] – 2026-04-19

### Added
- Retro panel styling with CSS custom properties (design tokens in
  `src/styles/tokens.css`).
- Per-drawing URL hash sync (`#/d/<id>`) with browser back/forward support.
- Custom canvas sizes: preset square grid picker (`sizes` prop + managed-size mode).
- Context-menu overhaul: right-click on canvas opens a positioned menu with undo,
  redo, zoom, selection, layer, and rotate actions.
- Per-drawing palette selection (`paletteId` prop) stored in the `Drawing` schema.
- `@testing-library/user-event` added; component test coverage expanded.
- Hash-sync and palette unit tests.

## [0.5.0] – 2026-04-19

### Added
- Layers panel (`LayersPanel`): add, duplicate, rename, delete, reorder, toggle
  visibility, set opacity, lock layers. Renders as a right-side floating panel.
- Drawings panel (`DrawingsPanel`): list, add, duplicate, rename, delete, and switch
  drawings. Renders as a left-side floating panel.
- App chrome refactored: hamburger menu, FileMenu, RecentColorsPanel.
- Floating panel system (`FloatingPanel`) with portal support for utilities cluster.
- `TitlePanel` (floating, top-center): inline-edit drawing name + zoom readout.

## [0.4.0] – 2026-04-19

### Added
- Layered data model (schema v2): each `Drawing` holds a `Layer[]` stack with
  per-layer `pixels`, `visible`, `opacity`, `locked`.
- Composite rendering pipeline: one offscreen `HTMLCanvasElement` per layer;
  `compositeLayers` blits them bottom-to-top with opacity.
- v1 → v2 migration runs in-memory at `loadStore()` time.

### Changed
- `Storage` key layout consolidated; `pixelator.store` holds the full v2 blob.

## [0.3.0] – 2026-04-19

### Added
- Viewport zoom and pan: CSS `transform` scales the canvas; Cmd/Ctrl+wheel or
  trackpad pinch zooms at the cursor point; Space+drag pans.
- Screen-space overlay canvas for marching-ants selection and pen anchor dots,
  kept in sync with the viewport transform via `ResizeObserver`.
- Pointer capture on the committed canvas so strokes continue off-canvas.
- `useViewport`, `useScreenOverlayDraw`, `useCanvasWheelZoom`, `useSpacebarPan`
  hooks extracted.

## [0.2.0] – 2026-04-19

### Added
- Marquee selection (rect, ellipse, wand) with marching-ants animation and
  selection-constrained paint / erase.
- Pen tool: click to place anchors, double-click to commit as open path, click
  first anchor to close shape.
- Shape tools: line, rect, circle, triangle, star, arrow — each with fill / outline
  mode and Shift-to-constrain.
- Brush sizes (1×1, 2×2, 3×3) applied to paint, eraser, and pen strokes.
- Flood fill with selection clipping.
- Eyedropper sampling the composited (visible) pixel rather than only the active layer.
- Undo / redo (50-step history, `usePixelArtHistory`).
- Recent colours panel; custom swatches persisted to `localStorage`.

## [0.1.0] – 2026-04-19

### Added
- Initial standalone pixel-art editor: Vite + React 19 + TypeScript strict,
  CSS Modules, `localStorage` persistence.
- Single-layer paint and eraser tools on a configurable grid.
- Hex colour input and palette swatches.
- PNG and SVG export.
- `pixelator.store` localStorage schema v1 (single `pixels` array per drawing).
