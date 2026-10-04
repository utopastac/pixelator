/**
 * Tests for the desktop-only iOS corner link.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppMobileContext } from '@/AppMobileContext';
import IosCornerLink from './IosCornerLink';

afterEach(() => {
  cleanup();
});

describe('IosCornerLink', () => {
  it('renders a link to /ios/ on desktop', () => {
    render(
      <AppMobileContext.Provider value={{ isMobile: false, setMobile: vi.fn() }}>
        <IosCornerLink />
      </AppMobileContext.Provider>,
    );
    const link = screen.getByTestId('ios-corner-link');
    expect(link).toHaveAttribute('href', '/ios/');
    expect(link).toHaveTextContent('Pixelator for iOS');
  });

  it('renders nothing on mobile', () => {
    render(
      <AppMobileContext.Provider value={{ isMobile: true, setMobile: vi.fn() }}>
        <IosCornerLink />
      </AppMobileContext.Provider>,
    );
    expect(screen.queryByTestId('ios-corner-link')).toBeNull();
  });
});
