const SIZE_MAP: Record<string, string> = {
  s: 'sm', small: 'sm',
  m: 'md', medium: 'md',
  l: 'lg', large: 'lg',
};

export function resolveSize<T extends string>(size: T | undefined, fallback: T): T {
  if (size === undefined) return fallback;
  return (SIZE_MAP[size] as T) ?? size;
}

/** Canonical two/three-step size scales with shorthand aliases. */
export type SizeSmMd = 'sm' | 'md' | 's' | 'm' | 'small' | 'medium';
export type SizeSmMdLg = 'sm' | 'md' | 'lg' | 's' | 'm' | 'l' | 'small' | 'medium' | 'large';
