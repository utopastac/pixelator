import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  drawCommitted,
  drawLayer,
  drawPreview,
  drawSelectionOverlay,
  drawAnchorDots,
  drawScreenOverlay,
  getSelectionEdgeSegments,
  type EdgeSegment,
} from './pixelArtCanvas';
import type { PixelArtSelection } from './pixelArtUtils';

// ── Canvas mock ──────────────────────────────────────────────────────────────

let ctxMock: ReturnType<typeof makeCtx>;
let getContextSpy: Mock;

function makeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    set fillStyle(_: string) {},
    get fillStyle() { return ''; },
    set strokeStyle(_: string) {},
    get strokeStyle() { return ''; },
    set lineWidth(_: number) {},
    get lineWidth() { return 1; },
    set globalAlpha(_: number) {},
    get globalAlpha() { return 1; },
    set lineDashOffset(_: number) {},
    get lineDashOffset() { return 0; },
  };
}

beforeEach(() => {
  ctxMock = makeCtx();
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as Mock;
  getContextSpy.mockReturnValue(ctxMock as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  getContextSpy.mockRestore();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvas(w = 4, h = 4): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Build a flat pixel array of size w×h, with specific cells painted. */
function makePixels(w: number, h: number, painted: Array<[number, number, string]> = []): string[] {
  const pixels = new Array<string>(w * h).fill('');
  for (const [col, row, color] of painted) {
    pixels[row * w + col] = color;
  }
  return pixels;
}

// ── drawCommitted ─────────────────────────────────────────────────────────────

describe('drawCommitted', () => {
  it('calls clearRect then fillRect with #ffffff for the background', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4);
    let bgCalled = false;

    const fillRectCalls: Array<[string, number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((...args) => {
      fillRectCalls.push([ctxMock.fillStyle as string, ...(args as [number, number, number, number])]);
    });
    let currentFillStyle = '';
    Object.defineProperty(ctxMock, 'fillStyle', {
      get: () => currentFillStyle,
      set: (v: string) => {
        currentFillStyle = v;
        if (v === '#ffffff') bgCalled = true;
      },
      configurable: true,
    });

    drawCommitted(canvas, pixels, 4);

    expect(ctxMock.clearRect).toHaveBeenCalledOnce();
    expect(bgCalled).toBe(true);
    expect(ctxMock.fillRect).toHaveBeenCalled();
  });

  it('paints non-empty cells at correct (col, row) positions after the background', () => {
    const canvas = makeCanvas(4, 4);
    // Paint cells: (1,0)=red, (0,2)=blue
    const pixels = makePixels(4, 4, [[1, 0, '#ff0000'], [0, 2, '#0000ff']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawCommitted(canvas, pixels, 4);

    // First call is the white background at (0,0,4,4)
    expect(calls[0]).toEqual([0, 0, 4, 4]);
    // Subsequent calls are pixel cells
    expect(calls).toContainEqual([1, 0, 1, 1]); // col=1, row=0
    expect(calls).toContainEqual([0, 2, 1, 1]); // col=0, row=2
    expect(calls.length).toBe(3); // background + 2 cells
  });

  it('skips empty cells', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4); // all empty

    drawCommitted(canvas, pixels, 4);

    // Only the background fillRect should be called
    expect(ctxMock.fillRect).toHaveBeenCalledOnce();
    expect(ctxMock.fillRect).toHaveBeenCalledWith(0, 0, 4, 4);
  });

  it('no-ops gracefully when getContext returns null', () => {
    getContextSpy.mockReturnValue(null);
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[0, 0, '#ff0000']]);

    expect(() => drawCommitted(canvas, pixels, 4)).not.toThrow();
    expect(ctxMock.clearRect).not.toHaveBeenCalled();
  });

  it('paints single pixel at (0,0) in a 4×4 grid', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[0, 0, '#ff0000']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawCommitted(canvas, pixels, 4);
    expect(calls).toContainEqual([0, 0, 1, 1]);
  });

  it('paints single pixel at (3,0) in a 4×4 grid', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[3, 0, '#ff0000']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawCommitted(canvas, pixels, 4);
    expect(calls).toContainEqual([3, 0, 1, 1]);
  });

  it('paints single pixel at (0,2) in a 4×4 grid', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[0, 2, '#ff0000']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawCommitted(canvas, pixels, 4);
    expect(calls).toContainEqual([0, 2, 1, 1]);
  });

  it('paints single pixel at (3,3) in a 4×4 grid', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[3, 3, '#ff0000']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawCommitted(canvas, pixels, 4);
    expect(calls).toContainEqual([3, 3, 1, 1]);
  });

  it('merges adjacent same-colour cells in a row into one horizontal fillRect', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [
      [0, 0, '#ff0000'],
      [1, 0, '#ff0000'],
      [2, 0, '#ff0000'],
    ]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawCommitted(canvas, pixels, 4);

    expect(calls[0]).toEqual([0, 0, 4, 4]);
    expect(calls).toContainEqual([0, 0, 3, 1]);
    expect(calls.length).toBe(2);
  });
});

// ── drawLayer ─────────────────────────────────────────────────────────────────

describe('drawLayer', () => {
  it('calls clearRect but does NOT paint a white (#ffffff) background', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4);

    const fillStylesSet: string[] = [];
    let currentFillStyle = '';
    Object.defineProperty(ctxMock, 'fillStyle', {
      get: () => currentFillStyle,
      set: (v: string) => {
        currentFillStyle = v;
        fillStylesSet.push(v);
      },
      configurable: true,
    });

    drawLayer(canvas, pixels, 4);

    expect(ctxMock.clearRect).toHaveBeenCalledOnce();
    expect(fillStylesSet).not.toContain('#ffffff');
    expect(ctxMock.fillRect).not.toHaveBeenCalled();
  });

  it('paints non-empty cells', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[2, 1, '#00ff00']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawLayer(canvas, pixels, 4);

    expect(calls).toContainEqual([2, 1, 1, 1]);
    expect(calls.length).toBe(1);
  });

  it('skips empty cells', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [[0, 0, '#ff0000'], [1, 0, ''], [2, 0, '']]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawLayer(canvas, pixels, 4);
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual([0, 0, 1, 1]);
  });

  it('all-empty pixel array → just clearRect, no fillRect', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4);

    drawLayer(canvas, pixels, 4);

    expect(ctxMock.clearRect).toHaveBeenCalledOnce();
    expect(ctxMock.fillRect).not.toHaveBeenCalled();
  });

  it('merges adjacent same-colour cells in a row into one horizontal fillRect', () => {
    const canvas = makeCanvas(4, 4);
    const pixels = makePixels(4, 4, [
      [0, 2, '#0000ff'],
      [1, 2, '#0000ff'],
      [2, 2, '#0000ff'],
    ]);

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawLayer(canvas, pixels, 4);

    expect(calls).toEqual([[0, 2, 3, 1]]);
  });
});

// ── drawPreview ───────────────────────────────────────────────────────────────

describe('drawPreview', () => {
  it('clears the canvas, sets globalAlpha to 0.7, then resets to 1', () => {
    const canvas = makeCanvas(4, 4);
    const alphaValues: number[] = [];
    let currentAlpha = 1;
    Object.defineProperty(ctxMock, 'globalAlpha', {
      get: () => currentAlpha,
      set: (v: number) => {
        currentAlpha = v;
        alphaValues.push(v);
      },
      configurable: true,
    });

    drawPreview(canvas, [[0, 0]], '#ff0000');

    expect(ctxMock.clearRect).toHaveBeenCalledOnce();
    expect(alphaValues).toContain(0.7);
    expect(alphaValues[alphaValues.length - 1]).toBe(1);
  });

  it('calls fillRect for each cell in the cells array', () => {
    const canvas = makeCanvas(4, 4);
    const cells: Array<[number, number]> = [[0, 0], [2, 1], [3, 3]];

    const calls: Array<[number, number, number, number]> = [];
    vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
      calls.push([x, y, w, h]);
    });

    drawPreview(canvas, cells, '#ff0000');

    expect(calls).toContainEqual([0, 0, 1, 1]);
    expect(calls).toContainEqual([2, 1, 1, 1]);
    expect(calls).toContainEqual([3, 3, 1, 1]);
    expect(calls.length).toBe(3);
  });

  it('resets globalAlpha to 1 after drawing', () => {
    const canvas = makeCanvas(4, 4);
    let finalAlpha = 0;
    let currentAlpha = 1;
    Object.defineProperty(ctxMock, 'globalAlpha', {
      get: () => currentAlpha,
      set: (v: number) => {
        currentAlpha = v;
        finalAlpha = v;
      },
      configurable: true,
    });

    drawPreview(canvas, [[1, 1]], '#ff0000');

    expect(finalAlpha).toBe(1);
  });

  it('empty cell array → clears canvas, no fillRect', () => {
    const canvas = makeCanvas(4, 4);

    drawPreview(canvas, [], '#ff0000');

    expect(ctxMock.clearRect).toHaveBeenCalledOnce();
    expect(ctxMock.fillRect).not.toHaveBeenCalled();
  });

  it('falls back to #000000 when color is empty string', () => {
    const canvas = makeCanvas(4, 4);
    const fillStyleValues: string[] = [];
    let currentFillStyle = '';
    Object.defineProperty(ctxMock, 'fillStyle', {
      get: () => currentFillStyle,
      set: (v: string) => {
        currentFillStyle = v;
        fillStyleValues.push(v);
      },
      configurable: true,
    });

    drawPreview(canvas, [[0, 0]], '');

    expect(fillStyleValues).toContain('#000000');
  });
});

// ── drawSelectionOverlay ──────────────────────────────────────────────────────

describe('drawSelectionOverlay', () => {
  describe('rect selection', () => {
    const sel: PixelArtSelection = { shape: 'rect', x1: 1, y1: 1, x2: 3, y2: 3 };

    it('calls fillRect for the blue tint with normalized x/y/w/h', () => {
      const canvas = makeCanvas(8, 8);
      const calls: Array<[number, number, number, number]> = [];
      vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
        calls.push([x, y, w, h]);
      });

      drawSelectionOverlay(canvas, sel, 0);

      // x = min(1,3)=1, y = min(1,3)=1, w = |3-1|+1=3, h = |3-1|+1=3
      expect(calls).toContainEqual([1, 1, 3, 3]);
    });

    it('calls strokeRect twice (white first, then black dashed)', () => {
      const canvas = makeCanvas(8, 8);

      drawSelectionOverlay(canvas, sel, 0);

      expect(ctxMock.strokeRect).toHaveBeenCalledTimes(2);
    });

    it('calls setLineDash with [] and then [4,4]', () => {
      const canvas = makeCanvas(8, 8);

      drawSelectionOverlay(canvas, sel, 0);

      const calls = (ctxMock.setLineDash as ReturnType<typeof vi.fn>).mock.calls;
      // First non-empty setLineDash call uses []
      expect(calls.some((c: unknown[]) => Array.isArray(c[0]) && c[0].length === 0)).toBe(true);
      // Then [4,4]
      expect(calls.some((c: unknown[]) => Array.isArray(c[0]) && c[0][0] === 4 && c[0][1] === 4)).toBe(true);
    });

    it('sets lineDashOffset to -marchingAntsOffset', () => {
      const canvas = makeCanvas(8, 8);
      let dashOffset = 0;
      Object.defineProperty(ctxMock, 'lineDashOffset', {
        get: () => dashOffset,
        set: (v: number) => { dashOffset = v; },
        configurable: true,
      });

      drawSelectionOverlay(canvas, sel, 5);

      expect(dashOffset).toBe(-5);
    });
  });

  describe('inverted rect (x1 > x2): normalized correctly', () => {
    it('normalizes so x = min, w = abs(x2-x1)+1', () => {
      const canvas = makeCanvas(8, 8);
      const invertedSel: PixelArtSelection = { shape: 'rect', x1: 3, y1: 3, x2: 1, y2: 1 };

      const calls: Array<[number, number, number, number]> = [];
      vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
        calls.push([x, y, w, h]);
      });

      drawSelectionOverlay(canvas, invertedSel, 0);

      // x = min(3,1)=1, y = min(3,1)=1, w = |1-3|+1=3, h = |1-3|+1=3
      expect(calls).toContainEqual([1, 1, 3, 3]);
    });
  });

  describe('ellipse selection', () => {
    const sel: PixelArtSelection = { shape: 'ellipse', x1: 0, y1: 0, x2: 3, y2: 3 };

    it('calls ellipse (not strokeRect)', () => {
      const canvas = makeCanvas(8, 8);

      drawSelectionOverlay(canvas, sel, 0);

      expect(ctxMock.ellipse).toHaveBeenCalledOnce();
      expect(ctxMock.strokeRect).not.toHaveBeenCalled();
    });

    it('calls fill and stroke', () => {
      const canvas = makeCanvas(8, 8);

      drawSelectionOverlay(canvas, sel, 0);

      expect(ctxMock.fill).toHaveBeenCalledOnce();
      expect(ctxMock.stroke).toHaveBeenCalled();
    });
  });

  describe('cells selection', () => {
    // Cells 0,1,4,5 in a 4-wide grid → (0,0),(1,0),(0,1),(1,1) (2×2 block)
    const sel: PixelArtSelection = {
      shape: 'cells',
      cells: new Set([0, 1, 4, 5]),
      x1: 0, y1: 0, x2: 1, y2: 1,
    };

    it('calls fillRect 4 times (one per cell)', () => {
      const canvas = makeCanvas(8, 8);
      const calls: Array<[number, number, number, number]> = [];
      vi.spyOn(ctxMock, 'fillRect').mockImplementation((x, y, w, h) => {
        calls.push([x, y, w, h]);
      });

      drawSelectionOverlay(canvas, sel, 0, 4);

      expect(calls.length).toBe(4);
    });

    it('calls beginPath (edge-path approach)', () => {
      const canvas = makeCanvas(8, 8);

      drawSelectionOverlay(canvas, sel, 0, 4);

      expect(ctxMock.beginPath).toHaveBeenCalled();
    });

    it('calls stroke twice (white, then black dashed)', () => {
      const canvas = makeCanvas(8, 8);

      drawSelectionOverlay(canvas, sel, 0, 4);

      expect(ctxMock.stroke).toHaveBeenCalledTimes(2);
    });
  });
});

// ── drawAnchorDots ────────────────────────────────────────────────────────────

describe('drawAnchorDots', () => {
  it('no-ops when anchors is empty (no fillRect/strokeRect)', () => {
    const canvas = makeCanvas(4, 4);

    drawAnchorDots(canvas, []);

    expect(ctxMock.fillRect).not.toHaveBeenCalled();
    expect(ctxMock.strokeRect).not.toHaveBeenCalled();
  });

  it('calls fillRect and strokeRect once for a single anchor', () => {
    const canvas = makeCanvas(4, 4);

    drawAnchorDots(canvas, [[2, 3]]);

    expect(ctxMock.fillRect).toHaveBeenCalledOnce();
    expect(ctxMock.strokeRect).toHaveBeenCalledOnce();
    expect(ctxMock.fillRect).toHaveBeenCalledWith(2, 3, 1, 1);
    expect(ctxMock.strokeRect).toHaveBeenCalledWith(2, 3, 1, 1);
  });

  it('calls fillRect and strokeRect N times for N anchors', () => {
    const canvas = makeCanvas(4, 4);
    const anchors: Array<[number, number]> = [[0, 0], [1, 2], [3, 3]];

    drawAnchorDots(canvas, anchors);

    expect(ctxMock.fillRect).toHaveBeenCalledTimes(3);
    expect(ctxMock.strokeRect).toHaveBeenCalledTimes(3);
  });

  it('no-ops when getContext returns null', () => {
    getContextSpy.mockReturnValue(null);
    const canvas = makeCanvas(4, 4);

    expect(() => drawAnchorDots(canvas, [[0, 0]])).not.toThrow();
    expect(ctxMock.fillRect).not.toHaveBeenCalled();
  });
});

// ── drawScreenOverlay ─────────────────────────────────────────────────────────

describe('drawScreenOverlay', () => {
  const baseParams = {
    selection: null as PixelArtSelection | null,
    anchors: [] as Array<[number, number]>,
    gridWidth: 8,
    gridHeight: 8,
    zoom: 8,
    panX: 0,
    panY: 0,
    marchingAntsOffset: 0,
    transformBox: null as { corners: Array<[number, number]> } | null,
  };

  it('no selection, no anchors, no transform box → just clearRect', () => {
    const canvas = makeCanvas(64, 64);

    drawScreenOverlay(canvas, { ...baseParams });

    expect(ctxMock.clearRect).toHaveBeenCalledOnce();
    expect(ctxMock.fillRect).not.toHaveBeenCalled();
    expect(ctxMock.strokeRect).not.toHaveBeenCalled();
    expect(ctxMock.arc).not.toHaveBeenCalled();
    expect(ctxMock.ellipse).not.toHaveBeenCalled();
  });

  describe('rect selection with zoom=8, panX=0, panY=0', () => {
    const sel: PixelArtSelection = { shape: 'rect', x1: 1, y1: 1, x2: 3, y2: 3 };

    it('calls fillRect (blue tint scaled by zoom)', () => {
      const canvas = makeCanvas(64, 64);

      drawScreenOverlay(canvas, { ...baseParams, selection: sel, zoom: 8 });

      // x1 = min(1,3)=1, y1 = min(1,3)=1, x2 = max(1,3)+1=4, y2 = max(1,3)+1=4
      // rx = panX + x1*zoom = 0+1*8=8, ry = 0+1*8=8
      // rw = (4-1)*8 = 24, rh = (4-1)*8 = 24
      expect(ctxMock.fillRect).toHaveBeenCalledWith(8, 8, 24, 24);
    });

    it('calls strokeRect twice', () => {
      const canvas = makeCanvas(64, 64);

      drawScreenOverlay(canvas, { ...baseParams, selection: sel, zoom: 8 });

      expect(ctxMock.strokeRect).toHaveBeenCalledTimes(2);
    });
  });

  describe('anchor dots at zoom=16, panX=0, panY=0', () => {
    it('calls arc at cell-centre screen position', () => {
      const canvas = makeCanvas(128, 128);
      // anchor at col=1, row=1
      // cx = panX + col*zoom + zoom/2 = 0 + 1*16 + 8 = 24
      // cy = panY + row*zoom + zoom/2 = 0 + 1*16 + 8 = 24

      drawScreenOverlay(canvas, { ...baseParams, anchors: [[1, 1]], zoom: 16 });

      expect(ctxMock.arc).toHaveBeenCalledOnce();
      expect(ctxMock.arc).toHaveBeenCalledWith(24, 24, 4, 0, Math.PI * 2);
    });

    it('calls fill and stroke for anchor dots', () => {
      const canvas = makeCanvas(128, 128);

      drawScreenOverlay(canvas, { ...baseParams, anchors: [[0, 0]], zoom: 16 });

      expect(ctxMock.fill).toHaveBeenCalledOnce();
      expect(ctxMock.stroke).toHaveBeenCalled();
    });
  });

  describe('transform box with 4 corners, zoom=8, panX=0, panY=0', () => {
    // NW(0,0), NE(4,0), SE(4,4), SW(0,4) in grid coords
    // Screen: NW(0,0), NE(32,0), SE(32,32), SW(0,32)
    const transformBox = {
      corners: [[0, 0], [4, 0], [4, 4], [0, 4]] as Array<[number, number]>,
    };

    it('draws outline path: beginPath, moveTo, 3×lineTo, closePath, stroke twice', () => {
      const canvas = makeCanvas(64, 64);

      drawScreenOverlay(canvas, { ...baseParams, zoom: 8, transformBox });

      expect(ctxMock.beginPath).toHaveBeenCalled();
      expect(ctxMock.moveTo).toHaveBeenCalled();
      expect(ctxMock.lineTo).toHaveBeenCalled();
      expect(ctxMock.closePath).toHaveBeenCalled();
      // stroke calls: 2 outline + 2 connector line + 1 rotate handle circle = 5
      expect(ctxMock.stroke).toHaveBeenCalledTimes(5);
    });

    it('draws 8 handle fillRect calls and 8 strokeRect calls', () => {
      const canvas = makeCanvas(64, 64);
      const fillCalls: number[] = [];
      const strokeCalls: number[] = [];
      vi.spyOn(ctxMock, 'fillRect').mockImplementation(() => { fillCalls.push(1); });
      vi.spyOn(ctxMock, 'strokeRect').mockImplementation(() => { strokeCalls.push(1); });

      drawScreenOverlay(canvas, { ...baseParams, zoom: 8, transformBox });

      expect(fillCalls.length).toBe(8);
      expect(strokeCalls.length).toBe(8);
    });

    it('draws rotate handle: arc, fill, stroke called', () => {
      const canvas = makeCanvas(64, 64);

      drawScreenOverlay(canvas, { ...baseParams, zoom: 8, transformBox });

      expect(ctxMock.arc).toHaveBeenCalled();
      expect(ctxMock.fill).toHaveBeenCalled();
    });
  });
});

// ── getSelectionEdgeSegments ──────────────────────────────────────────────────

describe('getSelectionEdgeSegments', () => {
  function sortSegs(segs: EdgeSegment[]) {
    return [...segs].sort((a, b) =>
      a.y1 !== b.y1 ? a.y1 - b.y1 :
      a.x1 !== b.x1 ? a.x1 - b.x1 :
      a.y2 !== b.y2 ? a.y2 - b.y2 : a.x2 - b.x2,
    );
  }

  it('single cell produces 4 edges (all sides external)', () => {
    const cells = new Set([0]); // cell (0,0) in a 4-wide grid
    const segs = getSelectionEdgeSegments(cells, 4);
    expect(segs).toHaveLength(4);
  });

  it('two horizontally adjacent cells share one edge — 6 edges total', () => {
    // cells (0,0) and (1,0) in a 4-wide grid: indices 0 and 1
    const cells = new Set([0, 1]);
    const segs = getSelectionEdgeSegments(cells, 4);
    expect(segs).toHaveLength(6);
  });

  it('2×2 filled square produces 8 external edges', () => {
    // cells (0,0),(1,0),(0,1),(1,1) in a 4-wide grid: indices 0,1,4,5
    const cells = new Set([0, 1, 4, 5]);
    const segs = getSelectionEdgeSegments(cells, 4);
    expect(segs).toHaveLength(8);
  });

  it('L-shape excludes internal shared edges', () => {
    // 3 cells in an L: (0,0),(0,1),(1,1) in a 4-wide grid: indices 0,4,5
    const cells = new Set([0, 4, 5]);
    const segs = getSelectionEdgeSegments(cells, 4);
    // Perimeter of L-shape = 8 edges
    expect(segs).toHaveLength(8);
  });

  it('left-column cell has a left edge even without a left neighbour', () => {
    // cell index 0 = col 0 — left edge is always external (col === 0 guard)
    const cells = new Set([0]);
    const segs = getSelectionEdgeSegments(cells, 4);
    const leftEdge = segs.find(s => s.x1 === 0 && s.x2 === 0);
    expect(leftEdge).toBeDefined();
  });

  it('right-column cell has a right edge via gridWidth guard', () => {
    // In a 4-wide grid, col 3 = index 3. Right edge uses col === gridWidth - 1.
    const cells = new Set([3]);
    const segs = getSelectionEdgeSegments(cells, 4);
    const rightEdge = segs.find(s => s.x1 === 4 && s.x2 === 4);
    expect(rightEdge).toBeDefined();
  });

  it('segments are in grid coordinates, not screen pixels', () => {
    const cells = new Set([0]); // cell (0,0)
    const segs = sortSegs(getSelectionEdgeSegments(cells, 4));
    // top edge: x1=0,y1=0 → x2=1,y2=0
    expect(segs).toContainEqual({ x1: 0, y1: 0, x2: 1, y2: 0 });
    // bottom edge: x1=0,y1=1 → x2=1,y2=1
    expect(segs).toContainEqual({ x1: 0, y1: 1, x2: 1, y2: 1 });
  });
});
