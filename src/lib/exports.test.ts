/**
 * PNG export is not tested here — `pixelsToPngBlob` depends on
 * `canvas.getContext('2d')` and `canvas.toBlob`, which jsdom doesn't implement
 * usefully. SVG export, filename sanitisation, and the download plumbing are
 * fully testable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportSvg } from './exports';
import type { Drawing, Layer } from './storage';

function makeLayer(id: string, pixels: string[], overrides: Partial<Layer> = {}): Layer {
  return { id, name: id, visible: true, opacity: 1, pixels, ...overrides };
}

function makeDrawing(overrides: Partial<Drawing> = {}): Drawing {
  return {
    id: 'd1',
    name: 'Untitled',
    width: 2,
    height: 2,
    layers: [makeLayer('l1', ['', '', '', ''])],
    activeLayerId: 'l1',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

interface Captured {
  content: string;
  type: string;
  filename: string;
}

function installDownloadCapture(): { captured: Captured[]; restore: () => void } {
  const captured: Captured[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();

  // Intercept Blob construction so we can read the text content and mime type
  // synchronously — jsdom's Blob doesn't implement `.text()`.
  const OrigBlob = globalThis.Blob;
  let lastContent = '';
  let lastType = '';
  class CapturingBlob extends OrigBlob {
    constructor(parts: BlobPart[] = [], options: BlobPropertyBag = {}) {
      super(parts, options);
      lastContent = parts.map((p) => (typeof p === 'string' ? p : '')).join('');
      lastType = options.type ?? '';
    }
  }
  globalThis.Blob = CapturingBlob as unknown as typeof Blob;

  const origCreateElement = document.createElement.bind(document);
  const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreateElement(tag);
    if (tag === 'a') {
      const a = el as HTMLAnchorElement;
      a.click = function () {
        captured.push({ content: lastContent, type: lastType, filename: a.download });
      };
    }
    return el;
  });

  return {
    captured,
    restore: () => {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      createSpy.mockRestore();
      globalThis.Blob = OrigBlob;
    },
  };
}

let harness: ReturnType<typeof installDownloadCapture>;

beforeEach(() => {
  harness = installDownloadCapture();
});

afterEach(() => {
  harness.restore();
});

describe('exportSvg', () => {
  it('emits an SVG with correct viewBox and rect for each painted pixel', () => {
    const drawing = makeDrawing({
      name: 'Smiley',
      width: 2,
      height: 2,
      layers: [makeLayer('l1', ['#ff0000', '', '', '#00ff00'])],
    });
    exportSvg(drawing);

    expect(harness.captured).toHaveLength(1);
    const { content: svg, type, filename } = harness.captured[0];
    expect(type).toBe('image/svg+xml');
    expect(filename).toBe('Smiley.svg');
    expect(svg).toContain('viewBox="0 0 2 2"');
    expect(svg).toContain('width="2"');
    expect(svg).toContain('height="2"');
    expect(svg).toContain('<rect x="0" y="0" width="1" height="1" fill="#ff0000"/>');
    expect(svg).toContain('<rect x="1" y="1" width="1" height="1" fill="#00ff00"/>');
    // Empty cells must not produce rects.
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    expect(rectCount).toBe(2);
  });

  it('flattens multiple layers bottom → top before encoding', () => {
    const drawing = makeDrawing({
      name: 'Layered',
      width: 2,
      height: 1,
      layers: [
        makeLayer('bg', ['#111111', '#111111']),
        makeLayer('top', ['#222222', '']),
      ],
    });
    exportSvg(drawing);
    const svg = harness.captured[0].content;
    // Top layer overrides cell 0, bottom shows through at cell 1.
    expect(svg).toContain('<rect x="0" y="0" width="1" height="1" fill="#222222"/>');
    expect(svg).toContain('<rect x="1" y="0" width="1" height="1" fill="#111111"/>');
  });

  it('skips invisible layers when flattening', () => {
    const drawing = makeDrawing({
      name: 'Hidden',
      width: 1,
      height: 1,
      layers: [
        makeLayer('bg', ['#111111']),
        makeLayer('top', ['#222222'], { visible: false }),
      ],
    });
    exportSvg(drawing);
    const svg = harness.captured[0].content;
    expect(svg).toContain('fill="#111111"');
    expect(svg).not.toContain('fill="#222222"');
  });

  it('sanitises filenames — spaces and punctuation become hyphens', () => {
    exportSvg(makeDrawing({ name: 'My Cool Drawing!!' }));
    expect(harness.captured[0].filename).toBe('My-Cool-Drawing.svg');
  });

  it('collapses repeated separators and strips leading/trailing hyphens', () => {
    exportSvg(makeDrawing({ name: '  ---hello---world---  ' }));
    expect(harness.captured[0].filename).toBe('hello-world.svg');
  });

  it('falls back to "pixel-art" when the name sanitises to empty', () => {
    exportSvg(makeDrawing({ name: '!!!' }));
    expect(harness.captured[0].filename).toBe('pixel-art.svg');
  });

  it('preserves underscores, digits, and hyphens in filenames', () => {
    exportSvg(makeDrawing({ name: 'sprite_01-final' }));
    expect(harness.captured[0].filename).toBe('sprite_01-final.svg');
  });
});
