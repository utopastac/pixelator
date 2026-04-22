/**
 * Tests for `EditorBars` — floating tools + optional title chrome (desktop split vs
 * mobile stacked). Merges former `ToolsPanel` and `TitlePanel` coverage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditorBars from './EditorBars';
import type { EditorBarsProps } from './EditorBars';
import type { EditorChromeData, EditorControlsWiring } from './Controls';
import { useEditorSessionStore } from '@/editor/stores/useEditorSessionStore';

vi.mock('@/editor/controls/SwatchesPopover', () => ({
  default: () => <div data-testid="swatches-popover" />,
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

beforeEach(() => {
  document.body.innerHTML = '';
  const cancelPenPath = vi.fn();
  useEditorSessionStore.getState().resetSession('#ff0000');
  useEditorSessionStore.setState({ cancelPenPath });
});

function defaultChrome(overrides: Partial<EditorChromeData> = {}): EditorChromeData {
  return {
    palette: ['#000000', '#ffffff'],
    customColors: [],
    panelsVisible: true,
    onTogglePanels: vi.fn(),
    onOpenShortcuts: vi.fn(),
    theme: 'light',
    onThemeToggle: vi.fn(),
    drawingsPanelOpen: false,
    onToggleDrawingsPanel: vi.fn(),
    ...overrides,
  };
}

function makeTitleWiring(overrides: Partial<EditorControlsWiring> = {}): EditorControlsWiring {
  return {
    title: 'My Drawing',
    onTitleChange: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    ...overrides,
  };
}

function renderToolsOnly(overrides: Partial<EditorChromeData> = {}) {
  const props: EditorBarsProps = {
    panelsVisible: true,
    isMobile: false,
    chrome: defaultChrome(overrides),
  };
  return render(<EditorBars {...props} />);
}

function renderWithTitleChrome(
  titleOverrides: Partial<EditorControlsWiring> = {},
  options?: { isMobile?: boolean },
) {
  const props: EditorBarsProps = {
    panelsVisible: true,
    isMobile: options?.isMobile ?? false,
    chrome: { ...defaultChrome(), ...makeTitleWiring(titleOverrides) },
  };
  return render(<EditorBars {...props} />);
}

// ---------------------------------------------------------------------------
// Tools toolbar (desktop)
// ---------------------------------------------------------------------------

describe('EditorBars — tools toolbar', () => {
  it('renders a toolbar region', () => {
    renderToolsOnly();
    expect(screen.getByRole('toolbar', { name: 'Pixel art tools' })).toBeInTheDocument();
  });

  it('renders all standard tool buttons', () => {
    renderToolsOnly();
    const labels = [
      'Move',
      'Marquee selection',
      'Brush size',
      'Paint',
      'Pen',
      'Line',
      'Shapes',
      'Eraser',
      'Fill',
      'Eyedropper',
    ];
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('renders the swatches popover', () => {
    renderToolsOnly();
    expect(screen.getByTestId('swatches-popover')).toBeInTheDocument();
  });

  it.each([
    ['Paint', 'paint'],
    ['Eraser', 'eraser'],
    ['Fill', 'fill'],
    ['Eyedropper', 'eyedropper'],
    ['Line', 'line'],
    ['Pen', 'pen'],
    ['Move', 'move'],
  ] as const)('clicking %s sets activeTool to "%s"', async (label, tool) => {
    const user = userEvent.setup();
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: label }));
    expect(useEditorSessionStore.getState().activeTool).toBe(tool);
  });

  it('clicking Paint calls cancelPenPath', async () => {
    const user = userEvent.setup();
    const cancelPenPath = vi.fn();
    useEditorSessionStore.setState({ cancelPenPath });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Paint' }));
    expect(cancelPenPath).toHaveBeenCalled();
  });

  it('clicking Marquee sets activeTool to "marquee"', async () => {
    const user = userEvent.setup();
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Marquee selection' }));
    expect(useEditorSessionStore.getState().activeTool).toBe('marquee');
  });

  it('renders layers panel toggle', () => {
    renderToolsOnly();
    expect(screen.getByTestId('toggle-layers-panel')).toBeInTheDocument();
  });

  it('clicking layers panel toggle flips layersPanelVisible in session store', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ layersPanelVisible: true });
    renderToolsOnly();
    await user.click(screen.getByTestId('toggle-layers-panel'));
    expect(useEditorSessionStore.getState().layersPanelVisible).toBe(false);
  });
});

describe('EditorBars — desktop help cluster', () => {
  it('renders drawings toggle in top-left chrome when wired', () => {
    renderToolsOnly();
    expect(screen.getByLabelText('Drawings')).toBeInTheDocument();
    expect(screen.getByTestId('open-drawings')).toBeInTheDocument();
  });

  it('renders Help region with panels, shortcuts, and theme controls', () => {
    renderToolsOnly();
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-panels')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('does not render Help on mobile', () => {
    const props: EditorBarsProps = {
      panelsVisible: true,
      isMobile: true,
      chrome: defaultChrome(),
    };
    render(<EditorBars {...props} />);
    expect(screen.queryByLabelText('Help')).not.toBeInTheDocument();
  });

  it('renders drawings toggle on mobile when panels are visible', () => {
    const props: EditorBarsProps = {
      panelsVisible: true,
      isMobile: true,
      chrome: defaultChrome(),
    };
    render(<EditorBars {...props} />);
    expect(screen.getByLabelText('Drawings')).toBeInTheDocument();
    expect(screen.getByTestId('open-drawings')).toBeInTheDocument();
  });

  it('keeps Help visible when panels are hidden (desktop)', () => {
    render(
      <EditorBars
        panelsVisible={false}
        isMobile={false}
        chrome={{ ...defaultChrome(), panelsVisible: false }}
      />,
    );
    expect(screen.queryByRole('toolbar', { name: 'Pixel art tools' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-panels')).toBeInTheDocument();
  });

  it('returns null when panels hidden on mobile', () => {
    const { container } = render(
      <EditorBars panelsVisible={false} isMobile={true} chrome={defaultChrome()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('EditorBars — shape button short press', () => {
  it('when not on a shape tool, switches to lastShape', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'paint', lastShape: 'circle' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().activeTool).toBe('circle');
  });

  it('when on rect tool, toggles rectFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'rect', rectFillMode: 'fill' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().rectFillMode).toBe('outline');
  });

  it('when on circle tool, toggles circleFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'circle', circleFillMode: 'fill' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().circleFillMode).toBe('outline');
  });

  it('when on triangle tool, toggles triangleFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'triangle', triangleFillMode: 'fill' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().triangleFillMode).toBe('outline');
  });

  it('when on star tool, toggles starFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'star', starFillMode: 'fill' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().starFillMode).toBe('outline');
  });

  it('when on arrow tool, toggles arrowFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'arrow', arrowFillMode: 'fill' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().arrowFillMode).toBe('outline');
  });

  it('fill mode toggler flips fill→outline', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'rect', rectFillMode: 'fill' });
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().rectFillMode).toBe('outline');
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().rectFillMode).toBe('fill');
  });
});

describe('EditorBars — brush size popover', () => {
  it('brush size popover is closed by default', () => {
    renderToolsOnly();
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });

  it('clicking brush size button opens the popover', async () => {
    const user = userEvent.setup();
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    expect(screen.getByRole('menu', { name: 'Brush size' })).toBeInTheDocument();
  });

  it('clicking brush size again closes the popover', async () => {
    const user = userEvent.setup();
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });

  it('picking a brush size updates store and closes the popover', async () => {
    const user = userEvent.setup();
    renderToolsOnly();
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    await user.click(screen.getByRole('menuitemradio', { name: /medium/i }));
    expect(useEditorSessionStore.getState().brushSize).toBe('md');
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Title chrome (top-center on desktop)
// ---------------------------------------------------------------------------

describe('EditorBars — title chrome', () => {
  it('renders the title text', () => {
    renderWithTitleChrome({ title: 'Pixel Art' });
    expect(screen.getByText('Pixel Art')).toBeInTheDocument();
  });

  it('renders an Undo button', () => {
    renderWithTitleChrome();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('renders a Redo button', () => {
    renderWithTitleChrome();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
  });

  it('Undo button is disabled when canUndo is false', () => {
    renderWithTitleChrome({ canUndo: false });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('Redo button is disabled when canRedo is false', () => {
    renderWithTitleChrome({ canRedo: false });
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('Undo button is enabled when canUndo is true', () => {
    renderWithTitleChrome({ canUndo: true });
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('Redo button is enabled when canRedo is true', () => {
    renderWithTitleChrome({ canRedo: true });
    expect(screen.getByRole('button', { name: 'Redo' })).not.toBeDisabled();
  });

  it('clicking Undo calls onUndo', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    renderWithTitleChrome({ canUndo: true, onUndo });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('clicking Redo calls onRedo', async () => {
    const user = userEvent.setup();
    const onRedo = vi.fn();
    renderWithTitleChrome({ canRedo: true, onRedo });
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('editing the title calls onTitleChange with the new value', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    renderWithTitleChrome({ title: 'Old Name', onTitleChange });
    const titleSpan = screen.getByRole('button', { name: 'Drawing name' });
    await user.dblClick(titleSpan);
    const input = await screen.findByRole('textbox', { name: 'Drawing name' });
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.keyboard('{Enter}');
    expect(onTitleChange).toHaveBeenCalledWith('New Name');
  });

  it('does not render zoom controls when viewport prop is absent', () => {
    renderWithTitleChrome();
    expect(screen.queryByRole('group', { name: 'Zoom controls' })).not.toBeInTheDocument();
  });

  it('renders zoom controls when a viewport prop is provided', () => {
    const viewport = { zoom: 1, setZoom: vi.fn(), fit: vi.fn(), isAutoFit: false };
    renderWithTitleChrome({ viewport });
    expect(screen.getByRole('group', { name: 'Zoom controls' })).toBeInTheDocument();
  });

  it('does not render the canvas size picker when sizes prop is absent', () => {
    renderWithTitleChrome();
    expect(screen.queryByRole('button', { name: /canvas size/i })).not.toBeInTheDocument();
  });

  it('renders the canvas size picker when sizes prop is provided', () => {
    renderWithTitleChrome({
      sizes: [8, 16, 32],
      currentWidth: 16,
      currentHeight: 16,
      onPickSize: vi.fn(),
    });
    expect(screen.getByRole('button', { name: /canvas size/i })).toBeInTheDocument();
  });
});

describe('EditorBars — symmetry picker', () => {
  it('does not render the symmetry button without setSymmetryMode', () => {
    renderWithTitleChrome();
    expect(screen.queryByRole('button', { name: 'Symmetry' })).not.toBeInTheDocument();
  });

  it('renders the symmetry button when setSymmetryMode is provided', () => {
    renderWithTitleChrome({ symmetryMode: 'none', setSymmetryMode: vi.fn() });
    expect(screen.getByRole('button', { name: 'Symmetry' })).toBeInTheDocument();
  });

  it('clicking symmetry opens the symmetry picker popover', async () => {
    const user = userEvent.setup();
    renderWithTitleChrome({ symmetryMode: 'none', setSymmetryMode: vi.fn() });
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    expect(screen.getByRole('menu', { name: 'Symmetry mode' })).toBeInTheDocument();
  });

  it('picking vertical symmetry calls setSymmetryMode("vertical")', async () => {
    const user = userEvent.setup();
    const setSymmetryMode = vi.fn();
    renderWithTitleChrome({ symmetryMode: 'none', setSymmetryMode });
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    await user.click(screen.getByRole('menuitemradio', { name: /vertical/i }));
    expect(setSymmetryMode).toHaveBeenCalledWith('vertical');
  });

  it('picking none closes the popover', async () => {
    const user = userEvent.setup();
    renderWithTitleChrome({ symmetryMode: 'vertical', setSymmetryMode: vi.fn() });
    await user.click(screen.getByRole('button', { name: 'Symmetry' }));
    await user.click(screen.getByRole('menuitemradio', { name: /none/i }));
    expect(screen.queryByRole('menu', { name: 'Symmetry mode' })).not.toBeInTheDocument();
  });
});

describe('EditorBars — tiling toggle', () => {
  it('does not render tiling button without setTilingEnabled', () => {
    renderWithTitleChrome();
    expect(screen.queryByRole('button', { name: 'Tiling preview' })).not.toBeInTheDocument();
  });

  it('renders tiling button when setTilingEnabled is provided', () => {
    renderWithTitleChrome({ tilingEnabled: false, setTilingEnabled: vi.fn() });
    expect(screen.getByRole('button', { name: 'Tiling preview' })).toBeInTheDocument();
  });

  it('clicking tiling when off calls setTilingEnabled(true)', async () => {
    const user = userEvent.setup();
    const setTilingEnabled = vi.fn();
    renderWithTitleChrome({ tilingEnabled: false, setTilingEnabled });
    await user.click(screen.getByRole('button', { name: 'Tiling preview' }));
    expect(setTilingEnabled).toHaveBeenCalledWith(true);
  });

  it('clicking tiling when on calls setTilingEnabled(false)', async () => {
    const user = userEvent.setup();
    const setTilingEnabled = vi.fn();
    renderWithTitleChrome({ tilingEnabled: true, setTilingEnabled });
    await user.click(screen.getByRole('button', { name: 'Tiling preview' }));
    expect(setTilingEnabled).toHaveBeenCalledWith(false);
  });
});

describe('EditorBars — grid overlay toggle', () => {
  it('does not render grid button without setGridOverlayVisible', () => {
    renderWithTitleChrome();
    expect(screen.queryByRole('button', { name: 'Grid overlay' })).not.toBeInTheDocument();
  });

  it('renders grid button when setGridOverlayVisible is provided', () => {
    renderWithTitleChrome({ gridOverlayVisible: true, setGridOverlayVisible: vi.fn() });
    expect(screen.getByRole('button', { name: 'Grid overlay' })).toBeInTheDocument();
  });

  it('clicking grid when on calls setGridOverlayVisible(false)', async () => {
    const user = userEvent.setup();
    const setGridOverlayVisible = vi.fn();
    renderWithTitleChrome({ gridOverlayVisible: true, setGridOverlayVisible });
    await user.click(screen.getByRole('button', { name: 'Grid overlay' }));
    expect(setGridOverlayVisible).toHaveBeenCalledWith(false);
  });

  it('clicking grid when off calls setGridOverlayVisible(true)', async () => {
    const user = userEvent.setup();
    const setGridOverlayVisible = vi.fn();
    renderWithTitleChrome({ gridOverlayVisible: false, setGridOverlayVisible });
    await user.click(screen.getByRole('button', { name: 'Grid overlay' }));
    expect(setGridOverlayVisible).toHaveBeenCalledWith(true);
  });
});

describe('EditorBars — mobile layout', () => {
  it('uses stacked bottom chrome when isMobile is true', () => {
    renderWithTitleChrome({ title: 'M' }, { isMobile: true });
    expect(screen.getByRole('region', { name: 'Drawing title' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Pixel art tools' })).toBeInTheDocument();
  });
});
