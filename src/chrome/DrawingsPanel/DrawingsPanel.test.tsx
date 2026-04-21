/**
 * Tests for `DrawingsPanel` — the left-side drawings gallery. Covers
 * rendering, active-drawing indication, selection, new-drawing button,
 * the per-row overflow menu (duplicate + delete with confirm dialog),
 * and name-prefix grouping with collapse/expand.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DrawingsPanel from './DrawingsPanel';
import type { Drawing } from '@/lib/storage';

// ContextMenu and ConfirmDialog portal to document.body; clear between tests
// so portals from one test don't bleed into the next. Also clear localStorage
// so the group collapse state doesn't leak across tests.
beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

// ContextMenu uses ResizeObserver internally — shim it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDrawing(id: string, name: string): Drawing {
  return {
    id,
    name,
    width: 8,
    height: 8,
    layers: [{ id: `${id}-layer`, name: 'Background', visible: true, opacity: 1, pixels: new Array(64).fill('') }],
    activeLayerId: `${id}-layer`,
    createdAt: 0,
    updatedAt: 0,
  };
}

const DRAWING_A = makeDrawing('a', 'Alpha');
const DRAWING_B = makeDrawing('b', 'Beta');

type Props = React.ComponentProps<typeof DrawingsPanel>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    isOpen: true,
    drawings: [DRAWING_A, DRAWING_B],
    currentDrawingId: 'a',
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onExportSvg: vi.fn(),
    onExportPng: vi.fn(),
    onExportPixelator: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering basics
// ---------------------------------------------------------------------------

describe('DrawingsPanel — rendering', () => {
  it('renders a row for each drawing by name', () => {
    render(<DrawingsPanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Beta' })).toBeInTheDocument();
  });

  it('panel is visible when open and aria-hidden when closed', () => {
    const { rerender } = render(<DrawingsPanel {...makeProps({ isOpen: true })} />);
    expect(screen.getByRole('complementary', { hidden: true })).not.toHaveAttribute('aria-hidden', 'true');

    rerender(<DrawingsPanel {...makeProps({ isOpen: false })} />);
    expect(screen.getByRole('complementary', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// Active drawing indication
// ---------------------------------------------------------------------------

describe('DrawingsPanel — active drawing', () => {
  it('marks the active drawing row with aria-pressed=true', () => {
    render(<DrawingsPanel {...makeProps({ currentDrawingId: 'a' })} />);
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks inactive drawing rows with aria-pressed=false', () => {
    render(<DrawingsPanel {...makeProps({ currentDrawingId: 'a' })} />);
    expect(screen.getByRole('button', { name: 'Open Beta' })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ---------------------------------------------------------------------------
// Selecting a drawing
// ---------------------------------------------------------------------------

describe('DrawingsPanel — selecting a drawing', () => {
  it('clicking a drawing row calls onSelect with that drawing id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DrawingsPanel {...makeProps({ onSelect })} />);
    await user.click(screen.getByRole('button', { name: 'Open Beta' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});

// ---------------------------------------------------------------------------
// New drawing button
// ---------------------------------------------------------------------------

describe('DrawingsPanel — new drawing', () => {
  it('clicking the New drawing button calls onNew', async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    render(<DrawingsPanel {...makeProps({ onNew })} />);
    await user.click(screen.getByRole('button', { name: 'New drawing' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Per-row overflow menu
// ---------------------------------------------------------------------------

describe('DrawingsPanel — drawing actions menu', () => {
  it('clicking Duplicate in the overflow menu calls onDuplicate', async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(<DrawingsPanel {...makeProps({ onDuplicate })} />);
    const [actionsBtn] = screen.getAllByRole('button', { name: 'Drawing actions' });
    await user.click(actionsBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('clicking Delete in the overflow menu shows a confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<DrawingsPanel {...makeProps()} />);
    const [actionsBtn] = screen.getAllByRole('button', { name: 'Drawing actions' });
    await user.click(actionsBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('confirming deletion calls onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<DrawingsPanel {...makeProps({ onDelete })} />);
    const [actionsBtn] = screen.getAllByRole('button', { name: 'Drawing actions' });
    await user.click(actionsBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByTestId('confirm-dialog-confirm'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Name-prefix grouping
// ---------------------------------------------------------------------------

describe('DrawingsPanel — name-prefix grouping', () => {
  const GROUP_A = makeDrawing('g1', 'template/Turtle');
  const GROUP_B = makeDrawing('g2', 'template/Rocket');
  const UNGROUPED = makeDrawing('u1', 'My Drawing');

  it('ungrouped drawings render without a group header', () => {
    render(<DrawingsPanel {...makeProps({ drawings: [UNGROUPED] })} />);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open My Drawing' })).toBeInTheDocument();
  });

  it('grouped drawings render under a capitalised group header', () => {
    render(<DrawingsPanel {...makeProps({ drawings: [GROUP_A, GROUP_B] })} />);
    expect(screen.getByRole('group', { name: 'Template' })).toBeInTheDocument();
  });

  it('grouped drawing rows show the short name (after the slash)', () => {
    render(<DrawingsPanel {...makeProps({ drawings: [GROUP_A, GROUP_B] })} />);
    expect(screen.getByRole('button', { name: 'Open template/Turtle' })).toBeInTheDocument();
    // The name span should display the short name
    expect(screen.getByText('Turtle')).toBeInTheDocument();
    expect(screen.getByText('Rocket')).toBeInTheDocument();
  });

  it('clicking the group header collapses the group rows', async () => {
    const user = userEvent.setup();
    render(<DrawingsPanel {...makeProps({ drawings: [GROUP_A, GROUP_B] })} />);
    const groupHeader = screen.getByRole('button', { name: 'Template' });
    // Initially expanded — rows visible
    expect(screen.getByText('Turtle')).toBeInTheDocument();
    await user.click(groupHeader);
    // After collapse — rows hidden
    expect(screen.queryByText('Turtle')).toBeNull();
    expect(screen.queryByText('Rocket')).toBeNull();
  });

  it('clicking the group header again re-expands the group', async () => {
    const user = userEvent.setup();
    render(<DrawingsPanel {...makeProps({ drawings: [GROUP_A, GROUP_B] })} />);
    const groupHeader = screen.getByRole('button', { name: 'Template' });
    await user.click(groupHeader); // collapse
    await user.click(groupHeader); // expand
    expect(screen.getByText('Turtle')).toBeInTheDocument();
  });

  it('ungrouped drawings render above groups', () => {
    render(<DrawingsPanel {...makeProps({ drawings: [UNGROUPED, GROUP_A] })} />);
    expect(screen.getByRole('button', { name: 'Open My Drawing' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Template' })).toBeInTheDocument();
  });
});
