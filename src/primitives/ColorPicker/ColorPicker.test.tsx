import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ColorPicker from './ColorPicker';

function makeMockCtx() {
  return {
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    imageSmoothingEnabled: false,
    lineWidth: 1,
    fillStyle: '',
    strokeStyle: '',
  };
}

// A predictable bounding rect: 200×200 at the origin.
const MOCK_RECT = {
  left: 0, top: 0, right: 200, bottom: 200,
  width: 200, height: 200, x: 0, y: 0,
  toJSON: () => ({}),
} as DOMRect;

/** jsdom may omit `PointerEvent`; ColorPicker uses pointer capture + document listeners. */
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class PolyPointerEvent extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.isPrimary = init.isPrimary ?? true;
    }
  } as unknown as typeof PointerEvent;
}

function pointerDown(target: Element, clientX: number, clientY: number) {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      clientX,
      clientY,
      bubbles: true,
      isPrimary: true,
      pointerId: 1,
    }),
  );
}

function pointerMoveOnDocument(clientX: number, clientY: number) {
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      clientX,
      clientY,
      bubbles: true,
      isPrimary: true,
      pointerId: 1,
    }),
  );
}

function pointerUpOnDocument() {
  document.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      isPrimary: true,
      pointerId: 1,
    }),
  );
}

describe('ColorPicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getContextSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getBCRSpy: any;

  beforeEach(() => {
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeMockCtx() as unknown as CanvasRenderingContext2D,
    );
    getBCRSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      MOCK_RECT,
    );
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    getBCRSpy.mockRestore();
  });

  it('renders and forwards data-testid', () => {
    render(<ColorPicker hue={0} saturation={0.5} brightness={0.5} onChange={vi.fn()} data-testid="cp" />);
    expect(screen.getByTestId('cp')).toBeInTheDocument();
  });

  it('renders two canvas elements', () => {
    const { container } = render(
      <ColorPicker hue={0} saturation={0.5} brightness={0.5} onChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('canvas')).toHaveLength(2);
  });

  it('pointerdown on the SV canvas calls onChange with s/v from click position', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={180} saturation={0} brightness={1} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    pointerDown(svCanvas, 100, 100);
    expect(onChange).toHaveBeenCalledOnce();
    const [h, s, v] = onChange.mock.calls[0] as [number, number, number];
    expect(h).toBe(180);
    expect(s).toBeCloseTo(0.5, 2);
    expect(v).toBeCloseTo(0.5, 2);
  });

  it('pointerdown on the hue canvas calls onChange with new hue', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0.8} brightness={0.6} onChange={onChange} />,
    );
    const canvases = container.querySelectorAll('canvas');
    const hueCanvas = canvases[1];
    pointerDown(hueCanvas, 100, 0);
    expect(onChange).toHaveBeenCalledOnce();
    const [h, s, v] = onChange.mock.calls[0] as [number, number, number];
    expect(h).toBe(180);
    expect(s).toBe(0.8);
    expect(v).toBe(0.6);
  });

  it('pointermove while dragging on SV calls onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0} brightness={1} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    pointerDown(svCanvas, 0, 0);
    onChange.mockClear();
    pointerMoveOnDocument(50, 50);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('pointerup ends drag — pointermove after pointerup does not fire onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0} brightness={1} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    pointerDown(svCanvas, 0, 0);
    pointerUpOnDocument();
    onChange.mockClear();
    pointerMoveOnDocument(50, 50);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps s and v to [0, 1] for out-of-bounds clicks', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0.5} brightness={0.5} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    pointerDown(svCanvas, 300, -50);
    const [, s, v] = onChange.mock.calls[0] as [number, number, number];
    expect(s).toBe(1);
    expect(v).toBe(1);
  });
});
