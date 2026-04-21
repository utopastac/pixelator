/**
 * Tests for `pixelsToPngBlob` — the PNG rasteriser that draws a flat pixel
 * array onto an offscreen canvas and returns a Blob via `toBlob`.
 *
 * jsdom's canvas `toBlob` doesn't work, so we stub both `getContext('2d')`
 * and `toBlob` to make the tests hermetic.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { pixelsToPngBlob } from './pixelArtPng';

// ---------------------------------------------------------------------------
// Canvas context stub
// ---------------------------------------------------------------------------

/** A minimal 2D context stub that records fillRect calls. */
function makeCtxStub() {
  const fillRectCalls: Array<[number, number, number, number]> = [];
  let _fillStyle = '';
  const ctx = {
    get fillStyle() { return _fillStyle; },
    set fillStyle(v: string) { _fillStyle = v; },
    fillRect: vi.fn((...args: [number, number, number, number]) => { fillRectCalls.push(args); }),
    clearRect: vi.fn(),
  };
  return { ctx, fillRectCalls };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let ctxStubBundle: ReturnType<typeof makeCtxStub>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getContextSpy: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let toBlobSpy: any;

beforeEach(() => {
  ctxStubBundle = makeCtxStub();

  // Stub getContext so it returns our fake ctx
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (type: string) => {
      if (type === '2d') return ctxStubBundle.ctx as unknown as CanvasRenderingContext2D;
      return null;
    },
  );

  // Stub toBlob to synchronously call its callback with a valid PNG Blob
  toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (cb: BlobCallback) {
      cb(new Blob(['png'], { type: 'image/png' }));
    },
  );
});

afterEach(() => {
  getContextSpy.mockRestore();
  toBlobSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Scale validation
// ---------------------------------------------------------------------------

describe('pixelsToPngBlob — scale validation', () => {
  it('throws for scale < 1', async () => {
    await expect(pixelsToPngBlob([], 4, 4, 0.5)).rejects.toThrow('scale must be >= 1');
  });

  it('throws for scale = 0', async () => {
    await expect(pixelsToPngBlob([], 4, 4, 0)).rejects.toThrow('scale must be >= 1');
  });

  it('throws for scale = NaN', async () => {
    await expect(pixelsToPngBlob([], 4, 4, NaN)).rejects.toThrow('scale must be >= 1');
  });

  it('throws for scale = Infinity', async () => {
    await expect(pixelsToPngBlob([], 4, 4, Infinity)).rejects.toThrow('scale must be >= 1');
  });

  it('throws for scale = -Infinity', async () => {
    await expect(pixelsToPngBlob([], 4, 4, -Infinity)).rejects.toThrow('scale must be >= 1');
  });
});

// ---------------------------------------------------------------------------
// Happy-path: valid scales
// ---------------------------------------------------------------------------

describe('pixelsToPngBlob — valid scale returns a PNG Blob', () => {
  it.each([1, 2, 8])('scale=%i resolves with a Blob of type image/png', async (scale) => {
    const pixels = new Array(4).fill('');
    const blob = await pixelsToPngBlob(pixels, 2, 2, scale);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });
});

// ---------------------------------------------------------------------------
// Empty pixel array
// ---------------------------------------------------------------------------

describe('pixelsToPngBlob — empty pixel array', () => {
  it('resolves successfully with no filled cells', async () => {
    const blob = await pixelsToPngBlob([], 0, 0, 1);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('does not call fillRect when all pixels are empty strings', async () => {
    const pixels = new Array(9).fill('');
    await pixelsToPngBlob(pixels, 3, 3, 1);
    expect(ctxStubBundle.ctx.fillRect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fillRect call counting
// ---------------------------------------------------------------------------

describe('pixelsToPngBlob — fillRect call count', () => {
  it('calls fillRect once per non-empty cell', async () => {
    // 3×3 grid: 3 colored cells, 6 transparent
    const pixels = [
      '#ff0000', '', '',
      '', '#00ff00', '',
      '', '', '#0000ff',
    ];
    await pixelsToPngBlob(pixels, 3, 3, 1);
    expect(ctxStubBundle.ctx.fillRect).toHaveBeenCalledTimes(3);
  });

  it('passes correct x, y, w, h to fillRect based on scale', async () => {
    // Single pixel at position (0,0), scale=4
    const pixels = ['#abc123'];
    await pixelsToPngBlob(pixels, 1, 1, 4);
    expect(ctxStubBundle.ctx.fillRect).toHaveBeenCalledWith(0, 0, 4, 4);
  });

  it('computes correct pixel column and row from flat index', async () => {
    // 2×2 grid: pixel at index 3 = col=1, row=1
    const pixels = ['', '', '', '#112233'];
    await pixelsToPngBlob(pixels, 2, 2, 2);
    // col = 3 % 2 = 1; row = Math.floor(3/2) = 1; scale=2
    // → fillRect(1*2, 1*2, 2, 2) = fillRect(2, 2, 2, 2)
    expect(ctxStubBundle.ctx.fillRect).toHaveBeenCalledWith(2, 2, 2, 2);
  });

  it('skips empty-string cells (no fillRect for transparent)', async () => {
    const pixels = ['#ff0000', '', '#0000ff', ''];
    await pixelsToPngBlob(pixels, 2, 2, 1);
    expect(ctxStubBundle.ctx.fillRect).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// toBlob returning null
// ---------------------------------------------------------------------------

describe('pixelsToPngBlob — toBlob null rejection', () => {
  it('rejects with a descriptive error when toBlob returns null', async () => {
    toBlobSpy.mockImplementation(function (cb: BlobCallback) {
      cb(null);
    });
    await expect(pixelsToPngBlob(['#ff0000'], 1, 1, 1)).rejects.toThrow(
      'canvas.toBlob returned null',
    );
  });
});
