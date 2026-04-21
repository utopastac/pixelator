/**
 * Tests for ToolsPanel — the floating tool toolbar. Covers tool selection,
 * shape short-press toggle vs. switch behaviour, and brush size/shape/marquee
 * popover visibility. SwatchesPopover is mocked to avoid canvas errors.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolsPanel, { type ToolsPanelProps } from './ToolsPanel';

vi.mock('../SwatchesPopover', () => ({
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
});

function makeProps(overrides: Partial<ToolsPanelProps> = {}): ToolsPanelProps {
  return {
    activeTool: 'paint',
    setActiveTool: vi.fn(),
    brushSize: 'sm',
    setBrushSize: vi.fn(),
    activeColor: '#ff0000',
    setActiveColor: vi.fn(),
    palette: ['#000000', '#ffffff'],
    customColors: [],
    setIndependentHue: vi.fn(),
    independentHue: null,
    rectFillMode: 'fill',
    setRectFillMode: vi.fn(),
    circleFillMode: 'fill',
    setCircleFillMode: vi.fn(),
    triangleFillMode: 'fill',
    setTriangleFillMode: vi.fn(),
    starFillMode: 'fill',
    setStarFillMode: vi.fn(),
    arrowFillMode: 'fill',
    setArrowFillMode: vi.fn(),
    lastShape: 'rect',
    setLastShape: vi.fn(),
    marqueeShape: 'rect',
    setMarqueeShape: vi.fn(),
    cancelPenPath: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('rendering', () => {
  it('renders a toolbar region', () => {
    render(<ToolsPanel {...makeProps()} />);
    expect(screen.getByRole('toolbar', { name: 'Pixel art tools' })).toBeInTheDocument();
  });

  it('renders all standard tool buttons', () => {
    render(<ToolsPanel {...makeProps()} />);
    const labels = ['Move', 'Marquee selection', 'Brush size', 'Paint', 'Pen', 'Line', 'Shapes', 'Eraser', 'Fill', 'Eyedropper'];
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('renders the swatches popover', () => {
    render(<ToolsPanel {...makeProps()} />);
    expect(screen.getByTestId('swatches-popover')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Simple tool selection
// ---------------------------------------------------------------------------

describe('tool selection', () => {
  it.each([
    ['Paint', 'paint'],
    ['Eraser', 'eraser'],
    ['Fill', 'fill'],
    ['Eyedropper', 'eyedropper'],
    ['Line', 'line'],
    ['Pen', 'pen'],
    ['Move', 'move'],
  ] as const)('clicking %s calls setActiveTool("%s")', async (label, tool) => {
    const user = userEvent.setup();
    const setActiveTool = vi.fn();
    render(<ToolsPanel {...makeProps({ setActiveTool })} />);
    await user.click(screen.getByRole('button', { name: label }));
    expect(setActiveTool).toHaveBeenCalledWith(tool);
  });

  it('clicking Paint calls cancelPenPath', async () => {
    const user = userEvent.setup();
    const cancelPenPath = vi.fn();
    render(<ToolsPanel {...makeProps({ cancelPenPath })} />);
    await user.click(screen.getByRole('button', { name: 'Paint' }));
    expect(cancelPenPath).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Marquee tool
// ---------------------------------------------------------------------------

describe('marquee selection', () => {
  it('clicking Marquee calls setActiveTool("marquee")', async () => {
    const user = userEvent.setup();
    const setActiveTool = vi.fn();
    render(<ToolsPanel {...makeProps({ setActiveTool })} />);
    await user.click(screen.getByRole('button', { name: 'Marquee selection' }));
    expect(setActiveTool).toHaveBeenCalledWith('marquee');
  });
});

// ---------------------------------------------------------------------------
// Shape short-press behaviour
// ---------------------------------------------------------------------------

describe('shape button short press', () => {
  it('when not on a shape tool, switches to lastShape', async () => {
    const user = userEvent.setup();
    const setActiveTool = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'paint', lastShape: 'circle', setActiveTool })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(setActiveTool).toHaveBeenCalledWith('circle');
  });

  it('when on rect tool, toggles rectFillMode', async () => {
    const user = userEvent.setup();
    const setRectFillMode = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'rect', setRectFillMode })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(setRectFillMode).toHaveBeenCalled();
  });

  it('when on circle tool, toggles circleFillMode', async () => {
    const user = userEvent.setup();
    const setCircleFillMode = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'circle', setCircleFillMode })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(setCircleFillMode).toHaveBeenCalled();
  });

  it('when on triangle tool, toggles triangleFillMode', async () => {
    const user = userEvent.setup();
    const setTriangleFillMode = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'triangle', setTriangleFillMode })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(setTriangleFillMode).toHaveBeenCalled();
  });

  it('when on star tool, toggles starFillMode', async () => {
    const user = userEvent.setup();
    const setStarFillMode = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'star', setStarFillMode })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(setStarFillMode).toHaveBeenCalled();
  });

  it('when on arrow tool, toggles arrowFillMode', async () => {
    const user = userEvent.setup();
    const setArrowFillMode = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'arrow', setArrowFillMode })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(setArrowFillMode).toHaveBeenCalled();
  });

  it('fill mode toggler flips fill→outline', async () => {
    const user = userEvent.setup();
    const setRectFillMode = vi.fn();
    render(<ToolsPanel {...makeProps({ activeTool: 'rect', rectFillMode: 'fill', setRectFillMode })} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    const toggler = setRectFillMode.mock.calls[0][0];
    expect(toggler('fill')).toBe('outline');
    expect(toggler('outline')).toBe('fill');
  });
});

// ---------------------------------------------------------------------------
// Brush size popover
// ---------------------------------------------------------------------------

describe('brush size popover', () => {
  it('brush size popover is closed by default', () => {
    render(<ToolsPanel {...makeProps()} />);
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });

  it('clicking brush size button opens the popover', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    expect(screen.getByRole('menu', { name: 'Brush size' })).toBeInTheDocument();
  });

  it('clicking brush size again closes the popover', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });

  it('picking a brush size calls setBrushSize and closes the popover', async () => {
    const user = userEvent.setup();
    const setBrushSize = vi.fn();
    render(<ToolsPanel {...makeProps({ setBrushSize })} />);
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    await user.click(screen.getByRole('menuitemradio', { name: /medium/i }));
    expect(setBrushSize).toHaveBeenCalledWith('md');
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });
});
