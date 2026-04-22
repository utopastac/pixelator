/**
 * Tests for ToolsPanel — the floating tool toolbar. Covers tool selection,
 * shape short-press toggle vs. switch behaviour, and brush size/shape/marquee
 * popover visibility. SwatchesPopover is mocked to avoid canvas errors.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolsPanel, { type ToolsPanelProps } from './ToolsPanel';
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

function makeProps(overrides: Partial<ToolsPanelProps> = {}): ToolsPanelProps {
  return {
    palette: ['#000000', '#ffffff'],
    customColors: [],
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
  ] as const)('clicking %s sets activeTool to "%s"', async (label, tool) => {
    const user = userEvent.setup();
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: label }));
    expect(useEditorSessionStore.getState().activeTool).toBe(tool);
  });

  it('clicking Paint calls cancelPenPath', async () => {
    const user = userEvent.setup();
    const cancelPenPath = vi.fn();
    useEditorSessionStore.setState({ cancelPenPath });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Paint' }));
    expect(cancelPenPath).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Marquee tool
// ---------------------------------------------------------------------------

describe('marquee selection', () => {
  it('clicking Marquee sets activeTool to "marquee"', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Marquee selection' }));
    expect(useEditorSessionStore.getState().activeTool).toBe('marquee');
  });
});

// ---------------------------------------------------------------------------
// Shape short-press behaviour
// ---------------------------------------------------------------------------

describe('shape button short press', () => {
  it('when not on a shape tool, switches to lastShape', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'paint', lastShape: 'circle' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().activeTool).toBe('circle');
  });

  it('when on rect tool, toggles rectFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'rect', rectFillMode: 'fill' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().rectFillMode).toBe('outline');
  });

  it('when on circle tool, toggles circleFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'circle', circleFillMode: 'fill' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().circleFillMode).toBe('outline');
  });

  it('when on triangle tool, toggles triangleFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'triangle', triangleFillMode: 'fill' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().triangleFillMode).toBe('outline');
  });

  it('when on star tool, toggles starFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'star', starFillMode: 'fill' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().starFillMode).toBe('outline');
  });

  it('when on arrow tool, toggles arrowFillMode', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'arrow', arrowFillMode: 'fill' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().arrowFillMode).toBe('outline');
  });

  it('fill mode toggler flips fill→outline', async () => {
    const user = userEvent.setup();
    useEditorSessionStore.setState({ activeTool: 'rect', rectFillMode: 'fill' });
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().rectFillMode).toBe('outline');
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(useEditorSessionStore.getState().rectFillMode).toBe('fill');
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

  it('picking a brush size updates store and closes the popover', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel {...makeProps()} />);
    await user.click(screen.getByRole('button', { name: 'Brush size' }));
    await user.click(screen.getByRole('menuitemradio', { name: /medium/i }));
    expect(useEditorSessionStore.getState().brushSize).toBe('md');
    expect(screen.queryByRole('menu', { name: 'Brush size' })).not.toBeInTheDocument();
  });
});
