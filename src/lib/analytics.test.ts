import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackBookingHandoffStarted, trackHikeWithAxeBannerClicked } from './analytics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google Analytics tracking', () => {
  it('tracks booking handoff attempts through gtag with route and passenger context', () => {
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);

    trackBookingHandoffStarted({
      locale: 'en',
      officialLocale: 'en',
      fromId: '7',
      fromName: 'Tbilisi (Natakhtari airport)',
      toId: '4',
      toName: 'Batumi',
      outboundDate: '2026-06-30',
      departureTime: '09:00',
      priceGel: '90 GEL',
      priceUsd: null,
      passengers: {
        adult: 2,
        child: 1,
        infant: 0,
      },
    });

    expect(gtag).toHaveBeenCalledWith('event', 'booking_handoff_started', {
      route: '7:4',
      from_id: '7',
      from_name: 'Tbilisi (Natakhtari airport)',
      to_id: '4',
      to_name: 'Batumi',
      outbound_date: '2026-06-30',
      departure_time: '09:00',
      locale: 'en',
      official_locale: 'en',
      adult_count: 2,
      child_count: 1,
      infant_count: 0,
      passenger_count: 3,
      price_gel: 90,
      price_gel_label: '90 GEL',
    });
  });

  it('does nothing when the Google tag is not available', () => {
    expect(() =>
      trackBookingHandoffStarted({
        locale: 'ua',
        officialLocale: 'en',
        fromId: '7',
        fromName: 'Tbilisi (Natakhtari airport)',
        toId: '4',
        toName: 'Batumi',
        outboundDate: '2026-06-30',
        departureTime: '',
        priceGel: '',
        priceUsd: null,
        passengers: {
          adult: 1,
          child: 0,
          infant: 0,
        },
      }),
    ).not.toThrow();
  });

  it('tracks a localized Hike With Axe banner click without requiring a booking handoff', () => {
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);

    trackHikeWithAxeBannerClicked({ locale: 'ua' });

    expect(gtag).toHaveBeenCalledWith('event', 'hike_with_axe_banner_clicked', {
      locale: 'ua',
      placement: 'header_banner',
      campaign: 'hike_with_axe_cross_promo',
    });
  });

  it('does not throw when the Hike With Axe banner Google tag throws', () => {
    vi.stubGlobal('gtag', () => {
      throw new Error('Google tag failed');
    });

    expect(() => trackHikeWithAxeBannerClicked({ locale: 'ru' })).not.toThrow();
  });
});
