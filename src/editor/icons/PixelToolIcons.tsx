import React from 'react';

type PixelIconProps = { size?: number; 'aria-hidden'?: boolean };

// Barrel: every SVG in the assets folder becomes an entry in `Icons`, keyed
// by its filename in PascalCase. Vite inlines the raw SVG strings at build
// time — dropping a new `.svg` into the folder is enough to expose it as
// `Icons.Foo` with no code changes here. Uses eager import so there's no
// extra round-trip for module loading; the total SVG payload is small.
const rawModules = import.meta.glob('@/assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function filenameToPascal(name: string): string {
  return name
    .replace(/\.svg$/i, '')
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

// Pre-theme each SVG string once at module load: replace the hardcoded black
// fill with currentColor so the icon picks up the enclosing button's text
// colour (hover, pressed, disabled, …). Per-render work is just a size
// substitution, which is cheap.
function createPixelIcon(raw: string): React.ComponentType<PixelIconProps> {
  const themed = raw.replace(/#000000/gi, 'currentColor');
  const Component: React.FC<PixelIconProps> = ({ size = 20, 'aria-hidden': ariaHidden = true }) => {
    const html = themed
      .replace(/width="\d+"/, `width="${size}"`)
      .replace(/height="\d+"/, `height="${size}"`);
    return (
      <span
        aria-hidden={ariaHidden}
        style={{ display: 'inline-flex', lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };
  return Component;
}

export const Icons: Record<string, React.ComponentType<PixelIconProps>> = Object.fromEntries(
  Object.entries(rawModules).map(([path, raw]) => {
    const file = path.split('/').pop() ?? '';
    return [filenameToPascal(file), createPixelIcon(raw)];
  }),
);

// Invisible placeholder. Returned when a named alias points at an asset that
// no longer exists on disk (e.g. the SVG was renamed or deleted mid-dev, or
// the dev-server glob is stale). Without this, `<Icon />` inside ToolbarButton
// crashes the whole app on any missing icon — this keeps the UI up and logs
// a warning instead of a white-screen stack trace.
const MissingIcon: React.FC<PixelIconProps> = ({ size = 20, 'aria-hidden': ariaHidden = true }) => (
  <span
    aria-hidden={ariaHidden}
    style={{ display: 'inline-block', width: size, height: size }}
  />
);

function resolveIcon(key: string): React.ComponentType<PixelIconProps> {
  const hit = Icons[key];
  if (hit) return hit;
  if (import.meta.env.DEV) {
    console.warn(
      `[PixelToolIcons] Missing icon "${key}". Expected asset at src/assets/icons/${key}.svg (PascalCase → kebab-case).`,
    );
  }
  return MissingIcon;
}

// ── Named aliases for the icons referenced by existing call sites ────────────
// New icons don't need an alias — reach them via `Icons.Foo`. Kept here so
// older imports keep working without the whole codebase having to churn.
// All aliases go through `resolveIcon` so a missing asset degrades to a blank
// placeholder instead of crashing the render tree.
export const PencilIcon = resolveIcon('Pencil');
export const EraserIcon = resolveIcon('Eraser');
export const FillIcon = resolveIcon('Fill');
export const GridIcon = resolveIcon('Grid');
export const EyedropperIcon = resolveIcon('EyeDropper');
export const PenIcon = resolveIcon('Pen');
export const LineIcon = resolveIcon('Line');
export const RectMarqueeIcon = resolveIcon('MarqueeRectangle');
export const CircleMarqueeIcon = resolveIcon('MarqueeCircle');
export const MagicWandIcon = resolveIcon('MagicWand');
export const RectIcon = resolveIcon('Rectangle');
export const CircleIcon = resolveIcon('Circle');
export const TriangleIcon = resolveIcon('Triangle');
export const StarIcon = resolveIcon('Star');
export const ArrowIcon = resolveIcon('Arrow');
// Filled counterparts — the un-suffixed aliases above are the outline variants.
export const RectFilledIcon = resolveIcon('RectangleFilled');
export const CircleFilledIcon = resolveIcon('CircleFilled');
export const TriangleFilledIcon = resolveIcon('TriangleFilled');
export const StarFilledIcon = resolveIcon('StarFilled');
export const ArrowFilledIcon = resolveIcon('ArrowFilled');
export const DownloadIcon = resolveIcon('Download');
export const BackIcon = resolveIcon('Back');
export const ForwardIcon = resolveIcon('Forward');
export const MenuIcon = resolveIcon('Menu');
export const MoreIcon = resolveIcon('More');
export const EyeIcon = resolveIcon('Eye');
export const EyeOffIcon = resolveIcon('EyeOff');
export const FocusOnIcon = resolveIcon('FocusOn');
export const FocusOffIcon = resolveIcon('FocusOff');
export const FocusBIcon = resolveIcon('FocusB');
export const FocusBOffIcon = resolveIcon('FocusBOff');
export const KeyboardIcon = resolveIcon('Keyboard');
export const MoonIcon = resolveIcon('Moon');
export const SunIcon = resolveIcon('Sun');
export const CheckIcon = resolveIcon('Check');
export const ChevronSmIcon = resolveIcon('ChevronSm');
export const DuplicateIcon = resolveIcon('Duplicate');
export const TrashIcon = resolveIcon('Trash');
export const ArrowUpIcon = resolveIcon('ArrowUp');
export const ArrowDownIcon = resolveIcon('ArrowDown');
export const SvgIcon = resolveIcon('Svg');
export const PngIcon = resolveIcon('Png');
export const UploadIcon = resolveIcon('Upload');
export const ImageIcon = resolveIcon('Image');
export const MoveIcon = resolveIcon('Move');
export const PlusIcon = resolveIcon('Plus');
export const MinusIcon = resolveIcon('Minus');
export const SelectAllIcon = resolveIcon('SelectAll');
export const LassoSelectIcon = resolveIcon('Select');
export const PolygonSelectIcon = resolveIcon('PolygonSelect');
export const FitToScreenIcon = resolveIcon('FitToScreen');
export const CloseIcon = resolveIcon('Close');
export const LayersIcon = resolveIcon('Layers');
export const FolderIcon = resolveIcon('Folder');
export const ZoomIcon = resolveIcon('Zoom');
export const GripVerticalIcon = resolveIcon('GripVertical');
export const ExportIcon = resolveIcon('Export');
export const LockIcon = resolveIcon('Lock');
export const LockFillIcon = resolveIcon('LockFill');
export const UnlockedIcon = resolveIcon('Unlocked');
export const UnlockedFillIcon = resolveIcon('UnlockedFill');
export const CutIcon = resolveIcon('Cut');
export const CopyIcon = resolveIcon('Copy');
export const PasteIcon = resolveIcon('Paste');
export const MergeDownIcon = resolveIcon('Merge');
export const TilingIcon = resolveIcon('Tile');
export const WrapIcon = resolveIcon('Infinity');
export const CornerIcon = resolveIcon('Corner');
export const BrushSmIcon = resolveIcon('BrushSmall');
export const BrushMdIcon = resolveIcon('BrushMedium');
export const BrushLgIcon = resolveIcon('BrushLarge');
export const BrushXlIcon = resolveIcon('BrushExtraLarge');
export const PaintInsideIcon = resolveIcon('PaintInside');

// Rotate glyph reused for both directions: CW uses the raw icon, CCW mirrors
// it on the X axis via a CSS transform on the wrapper span.
export const SymmetryVerticalIcon = resolveIcon('SymmetryVertical');
export const SymmetryHorizontalIcon = resolveIcon('SymmetryHorizontal');
export const SymmetryBothIcon = resolveIcon('SymmetryBoth');

export const RotateCWIcon = resolveIcon('Rotate');
export const RotateCCWIcon: React.FC<PixelIconProps> = ({ size = 20, 'aria-hidden': ariaHidden = true }) => {
  const Rotate = resolveIcon('Rotate');
  return (
    <span
      aria-hidden={ariaHidden}
      style={{ display: 'inline-flex', lineHeight: 0, transform: 'scaleX(-1)' }}
    >
      <Rotate size={size} aria-hidden={ariaHidden} />
    </span>
  );
};
