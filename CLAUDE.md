# Pixelator

Local pixel-art editor. Vite + React 19 + TypeScript strict, CSS Modules, no tests. Path alias `@/*` → `src/*`. All persistence is `localStorage`.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm run typecheck` — `tsc -b --noEmit`

## Layout

```
src/
  main.tsx, App.tsx, App.module.css    app shell + global state wiring
  views/EditorView.tsx                 thin Drawing → PixelArtEditor adapter
  editor/                              the editor — subfoldered:
    PixelArtEditor.tsx                   main component + wrapper/canvas CSS
    PixelArtEditor.module.css
    index.ts                             public re-exports
    canvasContextMenuItems.ts(+test)     pure builder for right-click menu
    useEditorCommands.ts                 hook bundling rotate/resize/
                                         download/selection-clear commands
    Toolbar/                             toolbar + its extracted popovers:
      PixelArtToolbar.tsx(+.module.css)
      DownloadMenu.tsx
      CanvasSizePicker.tsx(+.module.css)
      SwatchesPopover.tsx(+.module.css)
    LayersPanel/                         LayersPanel.tsx + .module.css
    ZoomControls/                        ZoomControls.tsx + .module.css
    RecentColorsPanel/                   floating recent-colors pill (self-contained)
    hooks/                               editor-internal hooks:
                                           useLayers, useViewport,
                                           useScreenOverlayDraw,
                                           useCanvasWheelZoom,
                                           useCanvasKeyboardShortcuts,
                                           useSpacebarPan,
                                           usePenHoverTracker,
                                           usePenTool,
                                           usePixelArtSelection,
                                           usePixelArtPointerHandlers,
                                           usePixelArtHistory,
                                           useLayerTransform,
                                           useMoveTransformTool,
                                           useLongPress,
                                           useEditorColorState,
                                           useRecentColors,
                                           useCustomColors
    lib/                                 editor-internal pure helpers:
                                           pixelArtUtils, pixelArtCanvas,
                                           pixelArtPng, pixelArtHistory,
                                           transforms, composite
    icons/                               PixelArtIcons, PixelToolIcons
  primitives/                          shared UI: ColorPicker, Popover,
                                       FloatingPanel, ToolbarButton, …
  overlays/                            ContextMenu, Tooltip
  chrome/                              app chrome: DrawingsPanel,
                                       ShortcutsDialog, Thumbnail, …
  hooks/                               app-level state (drawings, URL hash sync)
  lib/                                 storage, migrate, palettes, exports
  styles/tokens.css                    design tokens (CSS vars)
```

## Data model (`src/lib/storage.ts`)

Schema v2. `StoreShape` → `Drawing[]` + `currentDrawingId`. Each `Drawing`:

```ts
{ id, name, width, height,
  layers: Layer[],            // bottom → top
  activeLayerId,
  paletteId?,                 // optional; Default if absent
  createdAt, updatedAt }
```

A `Layer` has `{ id, name, visible, opacity, pixels }` where `pixels` is a
flat row-major `string[]` (index = `row * width + col`, `''` = transparent).

v1 → v2 migration runs in-memory in `loadStore()` and writes the migrated
blob back before returning. `paletteId` was added without a schema bump — it's
optional so older stored data decodes cleanly.

localStorage keys (note the inconsistent punctuation, don't "fix" it blindly):
- `pixelator.store` — full v2 store
- `pixelator.recentColors` — recents list (cap 15)
- `pixelator:customColors` — global custom swatches

## State ownership (who owns what, and where mutations must go)

| State | Owner | Notes |
|---|---|---|
| Drawing list, `currentDrawingId` | `useDrawings` in App.tsx | Autosaves via effect; `updateCurrentLayers` is 300ms debounced |
| Active color | `useEditorColorState` (editor-internal) | Fully self-contained; not surfaced to App |
| Recent colors | `useRecentColors` (editor-internal) | localStorage-backed; pushed once per stroke commit |
| Custom colors | `useCustomColors` (editor-internal) | localStorage-backed; editor persists directly |
| URL ↔ drawing id | `useDrawingHashSync` | `#/d/<id>` two-way sync, back/forward walks drawings |
| Layer stack + active layer + undo/redo | `usePixelArtHistory` (editor-internal) | **The only safe write path for layer mutations.** |
| Grid size | Editor's managed state when `sizes` prop is set | Mirrors back via `onSizeChange` |
| Zoom/pan | `useViewport` (editor-internal) | Canvas is 1:1 with grid; CSS transform does the scaling |
| Selection | `usePixelArtSelection` (editor-internal) | Intentionally **not** part of undo history |

The editor is remounted with `key={drawing.id}` in `EditorView` when the user
switches drawings. `PixelArtEditor`'s `initialSeed` `useMemo` is mount-only by
design — if you re-seed on prop change, autosave echo will clobber internal
history state.

## Undo/redo (`usePixelArtHistory`)

- Snapshot shape: `{ layers, width, height }`. Selection is excluded.
- `commitPixels(px)` — snapshot + write active-layer pixels (pushes history).
- `dispatchPixels(px)` — mid-drag write, no snapshot.
- `commitResize(layers, w, h)` — atomic layers+dimensions change.
- All structural layer ops (`addLayer`, `duplicateLayer`, `deleteLayer`,
  `renameLayer`, `moveLayer`, `setLayerVisibility`, `setLayerOpacity`, …)
  route through `applyLayers`, which snapshots + fires `onChange`.
- `HISTORY_LIMIT = 50`.

`useLayers` exposes direct CRUD too, but it **does not** snapshot or fire
`onChange`. The history hook wraps it and is the only entry point that keeps
undo + autosave consistent. Don't call `useLayers` mutations directly from
component code.

## Rendering pipeline

- One `HTMLCanvasElement` per layer (offscreen), kept in `offscreensRef: Map<layerId, canvas>`.
- `syncOffscreens()` evicts orphans + creates/resizes for every layer on
  layers/dimensions change.
- `drawLayer` rasterises pixels onto a layer's offscreen.
- `compositeLayers` clears the committed canvas to white, then blits each
  visible layer's offscreen bottom → top with its opacity.
- Grid overlay (`styles.gridOverlay`) only renders when `zoom >= 4`.
- Preview canvas handles in-flight shape/pen/brush previews; overlay canvas
  handles selection marching ants and pen anchors.

Export paths (`src/lib/exports.ts`, plus in-editor handlers) flatten layers
via `flattenLayers` (binary composition, opacity ignored), then SVG-encode or
PNG-rasterise.

## Colors

- Active color, recent colors, and custom colors are all **editor-internal**. App
  does not pass `activeColor`, `onActiveColorChange`, `onColorCommit`, `customColors`,
  or `onAddCustomColor` — the editor manages these entirely via `useEditorColorState`,
  `useRecentColors`, and `useCustomColors` (all in `src/editor/hooks/`).
- Recent list dedupes by lowercased hex — picking an existing recent **does
  not** bump it to the front (deliberate, avoids disorienting reorders).
- App imports `useRecentColors` and `useCustomColors` only to read their values
  for backup/restore (export-all + import). It calls `mergeRecentColors` /
  `mergeCustomColors` after a file import to merge in any saved recents/customs.
- Palette selection is **per-drawing** (`Drawing.paletteId`) and never mutates
  canvas pixels — only changes which swatches the toolbar shows.

## Floating UI

Props `floatingTools`, `floatingUtilities`, `floatingLayers` on
`PixelArtEditor` toggle floating-panel versions of each cluster. When
`floatingLayers` is on, the utilities pill **portals** its content into a slot
exposed by `LayersPanel` — so the utilities live inside the layers panel
rather than as a standalone pill. `layersUtilitiesSlot` holds that DOM node.

`.main` in App.module.css uses `--chrome-inset` (a CSS var) to shift the
hamburger + RecentColorsPanel past the DrawingsPanel when open, with a
transition. `--floating-offset` is the default gutter.

## Footguns

1. **Re-seeding the editor's history.** `initialSeed` is mount-only. Feed
   drawings in via `key={drawing.id}` remount, not by changing `value`.
2. **Bypassing history for layer mutations.** If a code path writes through
   `useLayers` directly, the change won't be undoable and won't autosave.
   Route through `usePixelArtHistory` / `applyLayers`.
3. **Color state is editor-internal.** Active color, recents, and custom colors
   are owned by editor-internal hooks. Do not add `activeColor`, `onColorCommit`,
   `customColors`, or `onAddCustomColor` props — the editor manages these directly
   and persists to localStorage without App involvement.
4. **Autosave debounce.** `updateCurrentLayers` is 300ms debounced.
   Non-pixel mutations (`renameDrawing`, `duplicateDrawing`, palette, resize)
   persist immediately via effect. Don't add a new mutation that only goes
   through the debounced path if you need it to survive a refresh.
5. **Hash sync is fire-and-forget.** Writing the hash echoes through
   `hashchange` → `onSelect(currentId)`, which no-ops; don't add a guard
   assuming it won't.
6. **Schema bumps.** Adding a required field to `Drawing` must increment
   `schemaVersion` and add a migration in `src/lib/migrate.ts`. Optional
   fields (like `paletteId`) are fine without a bump.

## Conventions

- Path alias `@/*` → `src/*` (vite.config.ts + tsconfig).
- CSS Modules (`*.module.css`). Global tokens in `src/styles/tokens.css`.
- TypeScript strict mode + `noUnusedLocals` + `noUnusedParameters`.
- React 19 — use function components + hooks. No class components.
- No test runner wired up. Verify changes by running `npm run typecheck` and
  `npm run dev` and exercising the UI.
- `lucide-react` for icons. No other UI library.

## Testing

- `npm run test:run` — vitest (unit + integration, 309 tests in `src/`).
- `npm run e2e` — Playwright Chromium smoke tests in `e2e/`. Runs against the
  production bundle via `npm run build && npm run preview` on port 4173 (not
  the dev server). Five specs cover cold boot, persistence, corrupt-storage
  recovery, unknown deep-link ids, and SVG export.

## Intentional error handling choices

**No structured error types (`Result<T,E>`, custom error classes).** The three
error sites in this codebase (`parseSvgPixels`, `saveStore`,
`ErrorBoundary.componentDidCatch`) all swallow unrecoverable errors — the
callers have no meaningful branch to take on a specific error shape. `Result`
types earn their keep when callers need to dispatch on error variants; none of
these do.

**`console.error` in three places — intentional, do not replace.** This is a
local browser app with no backend. The three calls are:
- `parseSvgPixels` catch block (`pixelArtUtils.ts`) — SVG parse failure,
  returns empty pixels gracefully.
- `saveStore` catch block (`storage.ts`) — localStorage quota exceeded or
  similar; nothing the app can do, silent drop is correct.
- `ErrorBoundary.componentDidCatch` (`ErrorBoundary.tsx`) — the canonical
  location for logging render panics; React's own docs recommend this.

There is no telemetry or logging infrastructure and none is needed — adding one
would be complexity with nowhere to send data.
