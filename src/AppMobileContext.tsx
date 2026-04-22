import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

/** Viewport at or below this width is treated as mobile layout app-wide. */
export const MOBILE_MEDIA_QUERY = '(max-width: 768px)';

function readMobileMatch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

export type AppMobileContextValue = {
  isMobile: boolean;
  setMobile: (next: boolean) => void;
};

/** Exposed for `Tooltip` and unit tests; prefer `useAppMobile` in app code. */
export const AppMobileContext = createContext<AppMobileContextValue | null>(null);

export function AppMobileProvider({ children }: { children: ReactNode }) {
  const [isMobile, setMobile] = useState(readMobileMatch);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isMobile) {
      root.setAttribute('data-mobile', 'true');
    } else {
      root.removeAttribute('data-mobile');
    }
    return () => {
      root.removeAttribute('data-mobile');
    };
  }, [isMobile]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return <AppMobileContext.Provider value={{ isMobile, setMobile }}>{children}</AppMobileContext.Provider>;
}

export function useAppMobile(): AppMobileContextValue {
  const v = useContext(AppMobileContext);
  if (v == null) {
    throw new Error('useAppMobile must be used within AppMobileProvider');
  }
  return v;
}

/** Returns null outside `AppMobileProvider` (e.g. isolated primitives tests). */
export function useAppMobileOptional(): AppMobileContextValue | null {
  return useContext(AppMobileContext);
}
