import type { Locale, OfficialFormLocale } from './i18n';

const BOOKING_HANDOFF_STARTED_EVENT = 'booking_handoff_started';

type AnalyticsProperty = string | number | boolean;
type AnalyticsProperties = Record<string, AnalyticsProperty>;
type GoogleTag = (command: 'event', eventName: string, properties?: AnalyticsProperties) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GoogleTag;
  }
}

export type BookingHandoffTrackingInput = {
  locale: Locale;
  officialLocale: OfficialFormLocale;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  outboundDate: string;
  departureTime: string;
  priceGel: string;
  priceUsd: string | null;
  passengers: {
    adult: number;
    child: number;
    infant: number;
  };
};

export function trackBookingHandoffStarted(input: BookingHandoffTrackingInput) {
  trackGoogleEvent(BOOKING_HANDOFF_STARTED_EVENT, buildBookingHandoffProperties(input));
}

export function trackHikeWithAxeBannerClicked({ locale }: { locale: Extract<Locale, 'ru' | 'ua'> }) {
  trackGoogleEvent('hike_with_axe_banner_clicked', {
    locale,
    placement: 'header_banner',
    campaign: 'hike_with_axe_cross_promo',
  });
}

function buildBookingHandoffProperties(input: BookingHandoffTrackingInput): AnalyticsProperties {
  const passengerCount = input.passengers.adult + input.passengers.child + input.passengers.infant;
  const properties: AnalyticsProperties = {
    route: `${input.fromId}:${input.toId}`,
    from_id: input.fromId,
    from_name: input.fromName,
    to_id: input.toId,
    to_name: input.toName,
    outbound_date: input.outboundDate,
    locale: input.locale,
    official_locale: input.officialLocale,
    adult_count: input.passengers.adult,
    child_count: input.passengers.child,
    infant_count: input.passengers.infant,
    passenger_count: passengerCount,
  };

  addStringProperty(properties, 'departure_time', input.departureTime);
  addStringProperty(properties, 'price_gel_label', input.priceGel);
  addStringProperty(properties, 'price_usd_label', input.priceUsd);

  const priceGel = parsePriceAmount(input.priceGel);
  if (priceGel !== null) {
    properties.price_gel = priceGel;
  }

  return properties;
}

function trackGoogleEvent(eventName: string, properties: AnalyticsProperties) {
  if (typeof window === 'undefined') return;

  try {
    window.gtag?.('event', eventName, properties);
  } catch {
    // Analytics must never block or break the booking handoff.
  }
}

function addStringProperty(properties: AnalyticsProperties, key: string, value: string | null) {
  if (value) {
    properties[key] = value;
  }
}

function parsePriceAmount(value: string) {
  const match = value.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;

  return Number(match[0].replace(',', '.'));
}
