/**
 * Tests for the dismissible iOS promo toast — visibility, link target, and
 * localStorage persistence across remounts.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import IosPromoToast, { IOS_PROMO_DISMISSED_KEY } from './IosPromoToast';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('IosPromoToast', () => {
  it('renders the promo with a link to /ios/ when not dismissed', () => {
    render(<IosPromoToast />);
    expect(screen.getByTestId('ios-promo-toast')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Pixelator for iOS' });
    expect(link).toHaveAttribute('href', '/ios/');
  });

  it('hides after dismiss and writes the localStorage flag', async () => {
    const user = userEvent.setup();
    render(<IosPromoToast />);
    await user.click(screen.getByTestId('ios-promo-dismiss'));
    expect(screen.queryByTestId('ios-promo-toast')).toBeNull();
    expect(localStorage.getItem(IOS_PROMO_DISMISSED_KEY)).toBe('1');
  });

  it('stays hidden on remount when the dismiss flag is set', () => {
    localStorage.setItem(IOS_PROMO_DISMISSED_KEY, '1');
    render(<IosPromoToast />);
    expect(screen.queryByTestId('ios-promo-toast')).toBeNull();
  });
});
