import { useCallback, useEffect, useRef, useState } from 'react'; // useState kept for isDrawingsPanelOpen + isResetConfirmOpen
import DrawingsPanel from '@/chrome/DrawingsPanel';
import ConfirmDialog from '@/primitives/ConfirmDialog';
import EditorView from '@/views/EditorView';
import ErrorBoundary from '@/primitives/ErrorBoundary';
import { useDrawings } from '@/hooks/useDrawings';
import { useRecentColors } from '@/editor/hooks/useRecentColors';
import { useCustomColors } from '@/editor/hooks/useCustomColors';
import { useDrawingHashSync } from '@/hooks/useDrawingHashSync';
import { useTheme } from '@/hooks/useTheme';
import { exportPng, exportSvg } from '@/lib/exports';
import {
  BackupParseError,
  backupFilename,
  buildAllEnvelope,
  buildDrawingEnvelope,
  parseEnvelope,
  rewriteDrawingIds,
  serializeEnvelope,
} from '@/lib/backup';
import styles from './App.module.css';
import { AppMobileProvider } from './AppMobileContext';

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const api = useDrawings();
  const {
    drawings,
    currentDrawing,
    currentDrawingId,
    selectDrawing,
    createDrawing,
    renameDrawing,
    duplicateDrawing,
    deleteDrawing,
    updateCurrentLayers,
    updateCurrentActiveLayerId,
    resizeCurrent,
    setDrawingPaletteId,
    appendDrawings,
  } = api;

  const { recents, mergeRecentColors } = useRecentColors();
  const { customColors, mergeCustomColors } = useCustomColors();
  const { theme, toggleTheme } = useTheme();
  // Hidden file input used by the DrawingsPanel "Import…" menu item. Lives at
  // the App level so the input is always in the DOM regardless of panel
  // open/closed state.
  const importInputRef = useRef<HTMLInputElement>(null);

  // Ensure there's always a drawing to edit. If storage is empty, seed one on
  // mount; if nothing's selected but drawings exist, pick the first.
  useEffect(() => {
    if (currentDrawing) return;
    if (drawings.length === 0) {
      createDrawing();
    } else {
      selectDrawing(drawings[0].id);
    }
  }, [currentDrawing, drawings, createDrawing, selectDrawing]);

  // Two-way sync between the selected drawing and `window.location.hash`
  // (`#/d/<id>`), so drawings are deep-linkable and browser back/forward
  // navigates between them.
  useDrawingHashSync({ drawings, currentDrawingId, onSelect: selectDrawing });

  const [isDrawingsPanelOpen, setIsDrawingsPanelOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [panelsVisible, setPanelsVisible] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '\\') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return;
      setPanelsVisible((v) => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleResetApp = useCallback(() => {
    // Wipe everything this app has ever written. localStorage is origin-wide,
    // so `clear()` is surgical enough (Pixelator owns its origin).
    localStorage.clear();
    window.location.reload();
  }, []);

  const handleExportAll = useCallback(() => {
    const env = buildAllEnvelope({
      drawings,
      recentColors: recents,
      customColors,
    });
    downloadJson(serializeEnvelope(env), backupFilename(env));
  }, [drawings, recents, customColors]);

  const handleExportCurrent = useCallback(() => {
    if (!currentDrawing) return;
    const env = buildDrawingEnvelope({ drawing: currentDrawing });
    downloadJson(serializeEnvelope(env), backupFilename(env));
  }, [currentDrawing]);

  const handleExportDrawing = useCallback(
    (id: string) => {
      const d = drawings.find((x) => x.id === id);
      if (!d) return;
      const env = buildDrawingEnvelope({ drawing: d });
      downloadJson(serializeEnvelope(env), backupFilename(env));
    },
    [drawings],
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const env = parseEnvelope(text);
        const fresh = rewriteDrawingIds(env.drawings);
        appendDrawings(fresh);
        if (env.recentColors) mergeRecentColors(env.recentColors);
        if (env.customColors) mergeCustomColors(env.customColors);
      } catch (err) {
        const msg = err instanceof BackupParseError ? err.message : 'Could not import backup.';
        // Minimal feedback — the menu itself has no status surface yet. A
        // follow-up pass can swap this for an inline toast.
        alert(`Import failed: ${msg}`);
      }
    },
    [appendDrawings, mergeRecentColors, mergeCustomColors],
  );

  return (
    <AppMobileProvider>
      <div className={styles.app}>
        <div className={`${styles.main} ${panelsVisible && isDrawingsPanelOpen ? styles.mainPanelOpen : ''}`}>
        {currentDrawing && (
          <ErrorBoundary>
            <EditorView
              drawing={currentDrawing}
              onChange={updateCurrentLayers}
              onActiveLayerIdChange={updateCurrentActiveLayerId}
              onSizeChange={resizeCurrent}
              onRename={renameDrawing}
              onPaletteChange={(id) => setDrawingPaletteId(currentDrawing.id, id)}
              theme={theme}
              onThemeToggle={toggleTheme}
              drawingsPanelOpen={isDrawingsPanelOpen}
              onToggleDrawingsPanel={() => setIsDrawingsPanelOpen((v) => !v)}
              onDownloadPixelator={handleExportCurrent}
              panelsVisible={panelsVisible}
              onTogglePanels={() => setPanelsVisible((v) => !v)}
            />
          </ErrorBoundary>
        )}
        {panelsVisible && <DrawingsPanel
          isOpen={isDrawingsPanelOpen}
          onDismiss={() => setIsDrawingsPanelOpen(false)}
          drawings={drawings}
          currentDrawingId={currentDrawingId}
          onSelect={selectDrawing}
          onNew={createDrawing}
          onDuplicate={duplicateDrawing}
          onDelete={deleteDrawing}
          onRename={renameDrawing}
          onExportSvg={(id) => {
            const d = drawings.find((x) => x.id === id);
            if (d) exportSvg(d);
          }}
          onExportPng={(id, scale) => {
            const d = drawings.find((x) => x.id === id);
            if (d) void exportPng(d, scale);
          }}
          onExportPixelator={handleExportDrawing}
          onExportAll={handleExportAll}
          onExportCurrent={handleExportCurrent}
          canExportCurrent={!!currentDrawing}
          onImportClick={() => importInputRef.current?.click()}
          onResetApp={() => setIsResetConfirmOpen(true)}
        />}

        <ConfirmDialog
          open={isResetConfirmOpen}
          title="Reset app?"
          body="This deletes every drawing, recent colour, custom colour, and theme preference. You can't undo this. Export a backup first if you want to keep your work."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          tertiaryLabel="Export backup"
          destructive
          onConfirm={handleResetApp}
          onCancel={() => setIsResetConfirmOpen(false)}
          onTertiary={handleExportAll}
        />
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          data-testid="import-file-input"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = '';
          }}
        />
        </div>
      </div>
    </AppMobileProvider>
  );
}
