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

  it('mousedown on the SV canvas calls onChange with s/v from click position', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={180} saturation={0} brightness={1} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    // rect is 200×200; clicking at (100, 100) → s = 100/200 = 0.5, v = 1 - 100/200 = 0.5
    svCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
    expect(onChange).toHaveBeenCalledOnce();
    const [h, s, v] = onChange.mock.calls[0] as [number, number, number];
    expect(h).toBe(180);
    expect(s).toBeCloseTo(0.5, 2);
    expect(v).toBeCloseTo(0.5, 2);
  });

  it('mousedown on the hue canvas calls onChange with new hue', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0.8} brightness={0.6} onChange={onChange} />,
    );
    const canvases = container.querySelectorAll('canvas');
    const hueCanvas = canvases[1];
    // clicking at x=100, width=200 → h = (100/200) * 360 = 180
    hueCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 0, bubbles: true }));
    expect(onChange).toHaveBeenCalledOnce();
    const [h, s, v] = onChange.mock.calls[0] as [number, number, number];
    expect(h).toBe(180);
    expect(s).toBe(0.8);
    expect(v).toBe(0.6);
  });

  it('mousemove while dragging on SV calls onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0} brightness={1} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    svCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
    onChange.mockClear();
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('mouseup ends drag — mousemove after mouseup does not fire onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0} brightness={1} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    svCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    onChange.mockClear();
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps s and v to [0, 1] for out-of-bounds clicks', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorPicker hue={0} saturation={0.5} brightness={0.5} onChange={onChange} />,
    );
    const [svCanvas] = container.querySelectorAll('canvas');
    // clientX=300 is past the 200px width → s clamped to 1; clientY=-50 → v clamped to 1
    svCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: -50, bubbles: true }));
    const [, s, v] = onChange.mock.calls[0] as [number, number, number];
    expect(s).toBe(1);
    expect(v).toBe(1);
  });
});
