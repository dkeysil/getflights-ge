import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import {
  loadManagedAlerts,
  readAlertsEnabled,
  requestManageLink,
  subscribeToRouteAlerts,
  unsubscribeManagedAlert,
} from './lib/alerts';
import { createTelegramAlertLink } from './lib/telegram-alerts';
import { bindTelegramLogin, readTelegramLoginConfig } from './lib/telegram-login';
import { getOfficialPurchaseRequest, loadAvailabilitySnapshot, searchFlights } from './lib/backend';
import { formatDateRange, formatSelectedDate, LOCALE_STORAGE_KEY } from './lib/i18n';

// The calendar always opens on the real current month, so range-picking fixtures
// are built from it instead of a frozen date.
const currentMonthDay = (dayOfMonth: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
};

const isoDay = (dayOfMonth: number) => {
  const date = currentMonthDay(dayOfMonth);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const bookableDayName = (dayOfMonth: number) =>
  `Choose available date ${formatSelectedDate(isoDay(dayOfMonth), 'en')} for Tbilisi (Natakhtari airport) to Batumi`;

const rangeStartDayName = (dayOfMonth: number) =>
  new RegExp(
    `^Choose alert range start ${formatSelectedDate(isoDay(dayOfMonth), 'en')} for Tbilisi \\(Natakhtari airport\\) to Batumi\\.`,
  );

const rangeEndDayName = (dayOfMonth: number) =>
  new RegExp(
    `^Choose alert range end ${formatSelectedDate(isoDay(dayOfMonth), 'en')} for Tbilisi \\(Natakhtari airport\\) to Batumi\\.`,
  );

const soldOutDayName = (dayOfMonth: number) =>
  `Unavailable date ${formatSelectedDate(isoDay(dayOfMonth), 'en')} for Tbilisi (Natakhtari airport) to Batumi`;

// While the end day is awaited, the fixed start and everything before it are
// out of reach and say so.
const pendingStartDayName = (dayOfMonth: number) =>
  `Alert range start ${formatSelectedDate(isoDay(dayOfMonth), 'en')} for Tbilisi (Natakhtari airport) to Batumi. Pick a later day to close the window.`;

const beforeStartDayName = (dayOfMonth: number) =>
  `Date before the alert range start ${formatSelectedDate(isoDay(dayOfMonth), 'en')} for Tbilisi (Natakhtari airport) to Batumi`;

// One bookable day in the current month so the calendar on screen is the one the
// alert range is picked from.
function currentMonthSnapshot(bookableDayOfMonth: number) {
  return {
    destinationMap: { '7': ['4'] },
    routeCatalog: [
      {
        from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
        destinations: [{ id: '4', name: 'Batumi' }],
      },
    ],
    availability: {
      '7:4': { outbound: [isoDay(bookableDayOfMonth)], returns: [] },
    },
    loadedAt: '2026-07-30T12:00:00.000Z',
  };
}

const oneFlight = {
  resultUrl: '/en/flights-form',
  flights: [
    {
      checkboxName: 'flight[0]',
      checkboxValue: '1',
      fromName: 'Tbilisi',
      toName: 'Batumi',
      dateLabel: 'Fri, Jul 31',
      time: '09:00',
      priceGel: '90 GEL',
      priceUsd: null,
    },
  ],
};

vi.mock('./lib/backend', () => ({
  loadAvailabilitySnapshot: vi.fn(async () => ({
    destinationMap: { '7': ['4'] },
    routeCatalog: [
      {
        from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
        destinations: [{ id: '4', name: 'Batumi' }],
      },
      {
        from: { id: '6', name: 'Mestia' },
        destinations: [{ id: '5', name: 'Kutaisi' }],
      },
    ],
    availability: {
      '7:4': { outbound: ['2026-07-31'], returns: [] },
      '6:5': { outbound: ['2026-07-01'], returns: [] },
    },
    loadedAt: '2026-07-30T12:00:00.000Z',
  })),
  searchFlights: vi.fn(async () => ({ resultUrl: '/ru/flights-form', flights: [] })),
  getOfficialPurchaseRequest: vi.fn(),
}));

vi.mock('./lib/alerts', () => ({
  readAlertsEnabled: vi.fn(() => false),
  subscribeToRouteAlerts: vi.fn(async () => ({ ok: true })),
  requestManageLink: vi.fn(async () => ({ ok: true })),
  loadManagedAlerts: vi.fn(async () => ({ subscriptions: [] })),
  unsubscribeManagedAlert: vi.fn(async () => ({ ok: true })),
  buildAlertReturnUrl: vi.fn(() => '/en/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31'),
}));

vi.mock('./lib/telegram-alerts', () => ({
  createTelegramAlertLink: vi.fn(async () => ({
    token: 'token-1',
    url: 'https://t.me/get_flights_ge_bot?start=token-1',
    expiresAt: '2026-08-01T10:05:00.000Z',
    matchingDates: [],
  })),
  isTelegramDeepLink: vi.fn(() => true),
}));

vi.mock('./lib/telegram-login', () => ({
  readTelegramLoginConfig: vi.fn(() => ({ enabled: true, botUsername: 'get_flights_ge_bot' })),
  bindTelegramLogin: vi.fn(async () => ({ needsStart: false, startUrl: null })),
  isTelegramBotLink: vi.fn(() => true),
}));

// Telegram's widget script never runs in jsdom, so the test plays its part: it
// calls the global callback the widget element registered, with the payload
// Telegram would have signed.
const telegramWidgetUser = { id: '555', first_name: 'Nino', auth_date: '1785312000', hash: 'a'.repeat(64) };

function signInWithTelegram(user = telegramWidgetUser) {
  const globals = window as unknown as Record<string, unknown>;
  const callbackName = Object.keys(globals).find((key) => key.startsWith('onTelegramAuth_'));
  if (!callbackName) throw new Error('The Telegram sign-in widget did not register a callback.');
  return (globals[callbackName] as (value: unknown) => void)(user);
}

function telegramCtas() {
  return document.querySelectorAll('[data-telegram-cta]');
}

beforeEach(() => {
  // `vi.restoreAllMocks()` in afterEach clears the factory implementations, so
  // the Telegram-login defaults are re-established per test.
  vi.mocked(readTelegramLoginConfig).mockReturnValue({ enabled: true, botUsername: 'get_flights_ge_bot' });
  vi.mocked(bindTelegramLogin).mockResolvedValue({ needsStart: false, startUrl: null });

  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('App localization', () => {
  it('opens the current month by default', async () => {
    const currentMonthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    expect(await screen.findByText(currentMonthLabel)).toBeInTheDocument();
  });

  it('initializes from the language URL and persists switcher changes', async () => {
    window.history.replaceState(null, '', '/?lang=ru');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText('Летают сейчас')).toBeInTheDocument();
    expect(screen.getByText('Тбилиси (Аэропорт Натахтари)')).toBeInTheDocument();
    expect(screen.getByText('🇬🇧')).toBeInTheDocument();
    expect(screen.getByText('🇷🇺')).toBeInTheDocument();
    expect(screen.getByText('🇺🇦')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Русский' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Українська' }));

    expect(window.location.pathname).toBe('/ua/');
    expect(window.location.search).toBe('');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ua');
    expect(screen.getByText('Літають зараз')).toBeInTheDocument();
    expect(screen.getByText('Тбілісі (Аеропорт Натахтарі)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Українська' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the Russian Hike With Axe banner and tracks its CTA click', async () => {
    window.history.replaceState(null, '', '/ru/');
    const user = userEvent.setup();
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);

    render(<App />);

    const link = await screen.findByRole('link', { name: /Смотреть походы/i });
    await user.click(link);

    expect(gtag).toHaveBeenCalledWith('event', 'hike_with_axe_banner_clicked', {
      locale: 'ru',
      placement: 'header_banner',
      campaign: 'hike_with_axe_cross_promo',
    });
  });

  it('fires an explicit page_view with the resolved location, path, and title after mount', async () => {
    window.history.replaceState(null, '', '/en/flights/mestia-kutaisi/');
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);

    render(<App />);

    await screen.findByRole('heading', { name: 'Buy Mestia to Kutaisi flight tickets' });

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_location: window.location.href,
      page_path: '/en/flights/mestia-kutaisi/',
      page_title: document.title,
    });
  });

  it('fires a fresh page_view for the new locale after switching languages', async () => {
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);

    render(<App />);

    await screen.findByText('Flying now');
    gtag.mockClear();

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    await waitFor(() => expect(window.location.pathname).toBe('/ru/'));
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({ page_path: '/ru/' }),
    );
  });

  it('renders route SEO copy and selects the matching official route', async () => {
    window.history.replaceState(null, '', '/en/flights/mestia-kutaisi/');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Buy Mestia to Kutaisi flight tickets' })).toBeInTheDocument();
    expect(screen.getAllByText(/official Vanilla Sky website/).length).toBeGreaterThan(0);
    expect(await screen.findByText('Mestia')).toBeInTheDocument();
    expect(screen.getByText('Kutaisi')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Domestic flight tickets in Georgia' })).toHaveAttribute(
      'href',
      '/en/flights/',
    );
    expect(screen.getByRole('link', { name: 'Vanilla Sky baggage and weather cancellation guide' })).toHaveAttribute(
      'href',
      '/en/blog/vanilla-sky-baggage-weather-cancellations/',
    );

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    expect(window.location.pathname).toBe('/ru/flights/mestia-kutaisi/');
  });

  it('renders homepage SEO navigation to popular route and guide pages', async () => {
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    const calendarDate = await screen.findByRole('button', {
      name: /Choose available date .* for Tbilisi \(Natakhtari airport\) to Batumi/i,
    });
    const seoHeading = screen.getByRole('heading', { name: 'Popular Vanilla Sky flight searches' });

    expect(seoHeading).toBeInTheDocument();
    expect(calendarDate.compareDocumentPosition(seoHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tbilisi to Batumi flight tickets' })).toHaveAttribute(
      'href',
      '/en/flights/tbilisi-batumi/',
    );
    expect(screen.getByRole('link', { name: 'Vanilla Sky booking guide' })).toHaveAttribute(
      'href',
      '/en/blog/how-to-buy-vanilla-sky-tickets/',
    );
    expect(screen.queryByRole('link', { name: /поход/i })).not.toBeInTheDocument();
  });

  it('links the brand logo to the localized homepage', async () => {
    window.history.replaceState(null, '', '/ru/blog/how-to-buy-vanilla-sky-tickets/');

    render(<App />);

    await screen.findByText('Летают сейчас');

    expect(screen.getByRole('link', { name: /GetFlights\.ge/ })).toHaveAttribute('href', '/ru/');
  });

  it('uses the manual refresh cache endpoint when the refresh button is clicked', async () => {
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();
    const loadAvailability = vi.mocked(loadAvailabilitySnapshot);

    render(<App />);

    await screen.findByText('Flying now');
    loadAvailability.mockClear();

    await user.click(screen.getByRole('button', { name: 'Refresh availability' }));

    expect(loadAvailability).toHaveBeenCalledWith(expect.any(AbortSignal), undefined, {
      refresh: true,
    });
  });

  it('exposes route, date, and booking controls with task-specific accessible names', async () => {
    window.history.replaceState(null, '', '/en/');
    vi.mocked(searchFlights).mockResolvedValueOnce({
      resultUrl: '/en/flights-form',
      flights: [
        {
          checkboxName: 'flight[0]',
          checkboxValue: '1',
          fromName: 'Tbilisi',
          toName: 'Batumi',
          dateLabel: 'Tue, Jun 30',
          time: '09:00',
          priceGel: '90 GEL',
          priceUsd: null,
        },
      ],
    });

    render(<App />);

    expect(
      await screen.findByRole('button', {
        name: /Select route Tbilisi \(Natakhtari airport\) to Batumi/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    expect(
      await screen.findByRole('button', {
        name: /Choose available date .* for Tbilisi \(Natakhtari airport\) to Batumi/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    expect(
      await screen.findByRole('button', {
        name: /Book Tbilisi \(Natakhtari airport\) to Batumi on .* with Vanilla Sky/i,
      }),
    ).toBeInTheDocument();
  });

  it('keeps routes with no tickets and shows that no dates are available', async () => {
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce({
      destinationMap: { '7': ['4'], '6': ['5'] },
      routeCatalog: [
        {
          from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
          destinations: [{ id: '4', name: 'Batumi' }],
        },
        {
          from: { id: '6', name: 'Mestia' },
          destinations: [{ id: '5', name: 'Kutaisi' }],
        },
      ],
      availability: {
        '7:4': { outbound: [], returns: [] },
        '6:5': { outbound: ['2026-07-01'], returns: [] },
      },
      loadedAt: '2026-06-30T12:00:00.000Z',
    });

    render(<App />);

    const route = await screen.findByRole('button', {
      name: /Select route Tbilisi \(Natakhtari airport\) to Batumi\. No dates available\./i,
    });

    expect(route).toBeInTheDocument();

    await user.click(route);

    expect(screen.getAllByText('No dates available')).not.toHaveLength(0);
  });

  it('does not infer ticket-release or sold-out status from unavailable upcoming-month dates', async () => {
    const upcomingMonth = new Date();
    upcomingMonth.setMonth(upcomingMonth.getMonth() + 1, 1);
    const upcomingMonthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
      upcomingMonth,
    );
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce({
      destinationMap: { '7': ['4'] },
      routeCatalog: [
        {
          from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
          destinations: [{ id: '4', name: 'Batumi' }],
        },
      ],
      availability: {
        '7:4': { outbound: [], returns: ['2026-08-02'] },
      },
      loadedAt: '2026-07-30T12:00:00.000Z',
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Next month' }));

    expect(await screen.findByText(upcomingMonthLabel)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: `${upcomingMonthLabel} tickets are not released yet` }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/This does not mean tickets are sold out/i)).not.toBeInTheDocument();
  });

  it('lets you pick an available previous-month day that leads the next month grid', async () => {
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce({
      destinationMap: { '7': ['4'] },
      routeCatalog: [
        {
          from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
          destinations: [{ id: '4', name: 'Batumi' }],
        },
      ],
      availability: {
        '7:4': { outbound: ['2026-07-31', '2026-08-05'], returns: [] },
      },
      loadedAt: '2026-07-17T12:00:00.000Z',
    });
    const julyThirtyFirst = 'Choose available date Friday, July 31, 2026 for Tbilisi (Natakhtari airport) to Batumi';

    render(<App />);

    await screen.findByRole('button', { name: julyThirtyFirst });

    // July 31 still leads the August grid, and it is marked available there.
    expect(screen.getByRole('button', { name: julyThirtyFirst })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: julyThirtyFirst }));

    expect(screen.getByRole('button', { name: julyThirtyFirst })).toHaveAttribute('aria-pressed', 'true');
    // Selecting it moves the calendar back to July, where July 1 is in the grid.
    expect(
      screen.getByRole('button', {
        name: 'Unavailable date Wednesday, July 1, 2026 for Tbilisi (Natakhtari airport) to Batumi',
      }),
    ).toBeInTheDocument();
  });

  it('tracks a GA4 booking handoff event when the official booking handoff starts', async () => {
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();
    const gtag = vi.fn();
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);
    vi.stubGlobal('open', vi.fn(() => ({ close: vi.fn() })));
    vi.stubGlobal('gtag', gtag);
    vi.mocked(searchFlights).mockResolvedValueOnce({
      resultUrl: '/en/flights-form',
      flights: [
        {
          checkboxName: 'flight[0]',
          checkboxValue: '1',
          fromName: 'Tbilisi',
          toName: 'Batumi',
          dateLabel: 'Tue, Jun 30',
          time: '09:00',
          priceGel: '90 GEL',
          priceUsd: null,
        },
      ],
    });
    vi.mocked(getOfficialPurchaseRequest).mockResolvedValueOnce({
      action: 'https://ticket.vanillasky.ge/en/tickets',
      fields: {
        form_id: 'form_select_date',
      },
    });

    render(<App />);

    await user.click(
      await screen.findByRole('button', {
        name: /Book Tbilisi \(Natakhtari airport\) to Batumi on .* with Vanilla Sky/i,
      }),
    );

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'booking_handoff_started',
      expect.objectContaining({
        route: '7:4',
        from_id: '7',
        to_id: '4',
        outbound_date: '2026-07-31',
        departure_time: '09:00',
        locale: 'en',
        official_locale: 'en',
        passenger_count: 1,
        price_gel: 90,
      }),
    );
  });

  it('formats the ticket card date with the active locale instead of the backend label', async () => {
    window.history.replaceState(null, '', '/ua/');
    vi.mocked(searchFlights).mockResolvedValueOnce({
      resultUrl: '/en/flights-form',
      flights: [
        {
          checkboxName: 'flight[0]',
          checkboxValue: '1',
          fromName: 'Tbilisi',
          toName: 'Batumi',
          dateLabel: 'July 02',
          time: '12:30',
          priceGel: '125 GEL',
          priceUsd: '40 USD',
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText('12:30')).toBeInTheDocument();
    expect(screen.queryByText('July 02')).not.toBeInTheDocument();
    expect(screen.getByText('пт, 31 лип.')).toBeInTheDocument();
  });

  it('renders the localized blog index and preserves it during language switches', async () => {
    window.history.replaceState(null, '', '/ru/blog/');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Гиды по билетам Vanilla Sky' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Как купить билеты Vanilla Sky онлайн' })).toHaveAttribute(
      'href',
      '/ru/blog/how-to-buy-vanilla-sky-tickets/',
    );
    expect(screen.getByRole('link', { name: 'Аэропорт Натахтари: что знать перед рейсом' })).toHaveAttribute(
      'href',
      '/ru/blog/natakhtari-airport-guide/',
    );

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(window.location.pathname).toBe('/en/blog/');
    expect(screen.getByRole('heading', { name: 'Vanilla Sky ticket guides' })).toBeInTheDocument();
  });

  it('renders localized blog guide content with source attribution and route links', async () => {
    window.history.replaceState(null, '', '/ru/blog/vanilla-sky-georgia-flights-guide/');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Vanilla Sky по Грузии: что знать перед покупкой билета' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Николай Левшиц в Telegram' })).toHaveAttribute(
      'href',
      'https://t.me/nlevshitstelegram',
    );
    expect(screen.getByRole('img', { name: /самолет/ })).toHaveAttribute(
      'src',
      '/vanilla-sky-georgia-flight-preview.png',
    );
    expect(screen.getByRole('link', { name: 'Проверить рейсы Тбилиси - Местиа' })).toHaveAttribute(
      'href',
      '/ru/flights/tbilisi-mestia/',
    );

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(window.location.pathname).toBe('/en/blog/vanilla-sky-georgia-flights-guide/');
    expect(screen.getByRole('heading', { name: 'Vanilla Sky flights in Georgia: what to know before you book' })).toBeInTheDocument();
    expect(screen.getByText(/Last updated: July 1, 2026/)).toBeInTheDocument();
  });

  it('hides alert controls when the frontend flag is off', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(false);
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByText('Flying now');

    expect(screen.queryByRole('heading', { name: 'No seats on sale for this day' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Watch this route instead' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage alerts' })).not.toBeInTheDocument();
  });

  it('ignores alert query params when the frontend flag is off and keeps the route-page selection', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(false);
    window.history.replaceState(
      null,
      '',
      '/en/flights/mestia-kutaisi/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31',
    );

    render(<App />);

    expect(await screen.findByRole('button', { name: /Select route Mestia to Kutaisi/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('heading', { name: 'Watch this route instead' })).not.toBeInTheDocument();
  });

  it('renders a collapsed, route-aware alert invite above the calendar it now drives', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(searchFlights).mockResolvedValueOnce(oneFlight);
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('button', {
      name: /Book Tbilisi \(Natakhtari airport\) to Batumi on .* with Vanilla Sky/i,
    });
    const panel = screen.getByRole('region', {
      name: 'Telegram alerts for Tbilisi (Natakhtari airport) → Batumi',
    });

    expect(screen.getByRole('heading', { name: 'Watch this route instead' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seats on Tbilisi (Natakhtari airport) → Batumi sell out and reopen. We can message you in Telegram when new ones appear.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Watching Jul 31 – Aug 7')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Set up an alert' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Pick dates in the calendar' })).not.toBeInTheDocument();
    expect(telegramCtas()).toHaveLength(0);
  });

  it('puts the alert entry above the calendar and outside the passenger and purchase zone', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(searchFlights).mockResolvedValueOnce(oneFlight);
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('button', {
      name: /Book Tbilisi \(Natakhtari airport\) to Batumi on .* with Vanilla Sky/i,
    });
    const panel = screen.getByRole('region', {
      name: 'Telegram alerts for Tbilisi (Natakhtari airport) → Batumi',
    });
    const calendarPanel = document.querySelector('.calendar-panel');
    const dayDetail = document.querySelector('.day-detail');

    expect(calendarPanel).not.toBeNull();
    expect(dayDetail).not.toBeNull();
    // Above the calendar it drives...
    expect(panel.compareDocumentPosition(calendarPanel as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // ...and clear of the passengers/tickets zone it used to live in.
    expect(dayDetail?.contains(panel)).toBe(false);
    expect(panel.parentElement).toBe(document.querySelector('.pane-main'));
  });

  it('opens the alert configuration on demand and keeps its aria state in sync', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(searchFlights).mockResolvedValueOnce({
      resultUrl: '/en/flights-form',
      flights: [
        {
          checkboxName: 'flight[0]',
          checkboxValue: '1',
          fromName: 'Tbilisi',
          toName: 'Batumi',
          dateLabel: 'Fri, Jul 31',
          time: '09:00',
          priceGel: '90 GEL',
          priceUsd: null,
        },
      ],
    });
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('button', {
      name: /Book Tbilisi \(Natakhtari airport\) to Batumi on .* with Vanilla Sky/i,
    });
    await user.click(screen.getByRole('button', { name: 'Set up an alert' }));

    const toggle = screen.getByRole('button', { name: 'Hide alert setup' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'telegram-alert-config');

    const rangeGroup = screen.getByRole('group', { name: 'Dates to watch' });
    expect(within(rangeGroup).getByText('Jul 31 – Aug 7')).toBeInTheDocument();
    // Opening the setup arms the calendar, and says so where it can be heard.
    const pickToggle = within(rangeGroup).getByRole('button', { name: 'Stop picking dates' });
    expect(pickToggle).toHaveAttribute('aria-pressed', 'true');
    expect(pickToggle).toHaveAttribute('aria-controls', 'availability-calendar');
    expect(within(rangeGroup).getByRole('button', { name: 'Reset to selected day' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tap the first day to watch in the calendar below.');
    // The standalone inputs and presets are gone.
    expect(screen.queryByLabelText('From date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To date')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Quick ranges' })).not.toBeInTheDocument();
    // Opening the setup arms the pick, so the action is not offered yet.
    expect(telegramCtas()).toHaveLength(0);
    expect(within(rangeGroup).getByText('Pick both dates to turn the alert on.')).toBeInTheDocument();
    // v1 alerts are Telegram-only: no email entry points remain.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage alerts' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Set up an alert' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Dates to watch' })).not.toBeInTheDocument();
  });

  it('expands the alert configuration as the recovery path when the day has no bookable seats', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'No seats on sale for this day' })).toBeInTheDocument();
    expect(
      screen.getByText(/we will message you in Telegram as soon as Tbilisi \(Natakhtari airport\) → Batumi is bookable/),
    ).toBeInTheDocument();
    // No toggle to hunt for: the configuration is the point of this state.
    expect(screen.queryByRole('button', { name: 'Set up an alert' })).not.toBeInTheDocument();
    // The recovery panel opens by itself, so the calendar stays in booking mode
    // until the traveller asks for it: they may still be hunting for a day.
    const rangeGroup = screen.getByRole('group', { name: 'Dates to watch' });
    expect(within(rangeGroup).getByRole('button', { name: 'Pick dates in the calendar' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(rangeGroup).getByText('These dates come from the calendar below.')).toBeInTheDocument();
    // One action, inside the block that shows the completed window.
    expect(telegramCtas()).toHaveLength(1);
    expect(rangeGroup.querySelectorAll('[data-telegram-cta]')).toHaveLength(1);

    expect(screen.getByText('Telegram asks you to confirm it is you — after that the alert is on.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'We message you once Tbilisi (Natakhtari airport) → Batumi has bookable seats inside those dates.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Send /stop in Telegram to end alerts any time.')).toBeInTheDocument();
  });

  it('defaults the watched range to the selected day plus a week and follows later day picks', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/?from=6&to=5');
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => expect(screen.getByText('Watching Jul 1 – Jul 8')).toBeInTheDocument());

    await user.click(await screen.findByRole('button', { name: /Select route Tbilisi \(Natakhtari airport\) to Batumi/i }));

    await waitFor(() => expect(screen.getByText('Watching Jul 31 – Aug 7')).toBeInTheDocument());
  });

  it('preselects route and range from query params when alerts are enabled', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/?from=6&to=5&dateFrom=2026-07-01&dateTo=2026-07-31');

    render(<App />);

    expect(await screen.findByRole('button', { name: /Select route Mestia to Kutaisi/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // A range carried by the URL outranks the selected-day default.
    expect(await screen.findByText('Watching Jul 1 – Jul 31')).toBeInTheDocument();
  });

  it('keeps a calendar-picked range pinned across routes and restores the default on reset', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: rangeEndDayName(20) }));

    const picked = formatDateRange(isoDay(5), isoDay(20), 'en');
    expect(screen.getByText(`Watching ${picked}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Select route Mestia to Kutaisi/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Select route Mestia to Kutaisi/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    // The calendar moved to 1 July, but a picked range is the traveller's to change.
    expect(screen.getByText(`Watching ${picked}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset to selected day' }));

    expect(screen.getByText('Watching Jul 1 – Jul 8')).toBeInTheDocument();
  });

  it('walks the calendar from start to end day and marks the whole inclusive window', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    // Booking mode: a sold-out day cannot be clicked.
    expect(screen.getByRole('button', { name: soldOutDayName(5) })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));

    // Range mode: sold-out days are exactly what an alert is for, so they open up.
    const startDay = screen.getByRole('button', { name: rangeStartDayName(5) });
    expect(startDay).toBeEnabled();
    await user.click(startDay);

    // The first click only fixes the start: nothing is committed yet, and the
    // hint names the day the window now runs from.
    expect(screen.getByRole('status')).toHaveTextContent(
      `Watching from ${formatDateRange(isoDay(5), isoDay(5), 'en')}. Now tap a later day to close the window`,
    );
    expect(screen.getByRole('button', { name: pendingStartDayName(5) }).className).toContain('range-pending');
    // Only strictly later days stay selectable — the start day included.
    expect(screen.getByRole('button', { name: pendingStartDayName(5) })).toBeDisabled();
    expect(screen.getByRole('button', { name: beforeStartDayName(4) })).toBeDisabled();
    expect(screen.getByRole('button', { name: rangeEndDayName(6) })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: rangeEndDayName(12) }));

    expect(
      screen.getByText(`Watching ${formatDateRange(isoDay(5), isoDay(12), 'en')}`),
    ).toBeInTheDocument();
    // Picking is done: the calendar goes back to choosing a day to book.
    expect(screen.getByRole('button', { name: 'Pick dates in the calendar' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: soldOutDayName(5) })).toBeDisabled();

    expect(screen.getByRole('button', { name: soldOutDayName(5) }).className).toContain('range-start');
    expect(screen.getByRole('button', { name: soldOutDayName(8) }).className).toContain('in-range');
    expect(screen.getByRole('button', { name: soldOutDayName(8) }).className).not.toContain('range-start');
    expect(screen.getByRole('button', { name: soldOutDayName(8) }).className).not.toContain('range-end');
    expect(screen.getByRole('button', { name: soldOutDayName(12) }).className).toContain('range-end');
    expect(screen.getByRole('button', { name: soldOutDayName(20) }).className).not.toContain('in-range');
  });

  it('refuses to close the window backwards: an earlier day is not selectable', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(20) }));

    const earlier = screen.getByRole('button', { name: beforeStartDayName(6) });
    expect(earlier).toBeDisabled();
    await user.click(earlier);

    // Still waiting for an end day: the pick did not flip direction or finish.
    expect(screen.getByRole('button', { name: 'Stop picking dates' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: pendingStartDayName(20) }).className).toContain('range-pending');
    expect(screen.getByRole('button', { name: beforeStartDayName(6) }).className).not.toContain('range-start');

    // A later day still closes it.
    await user.click(screen.getByRole('button', { name: rangeEndDayName(25) }));

    expect(screen.getByText(`Watching ${formatDateRange(isoDay(20), isoDay(25), 'en')}`)).toBeInTheDocument();
  });

  // Strictly-later is what makes the direction unambiguous, and the cost is that
  // a one-day window cannot be expressed by clicking the same day twice.
  it('never completes a single-day window from one day clicked twice', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: pendingStartDayName(5) }));

    expect(
      screen.queryByText(`Watching ${formatDateRange(isoDay(5), isoDay(5), 'en')}`),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop picking dates' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('restores the previous booking selection and window when the pick is cancelled mid-range', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    // The day the traveller had selected to book, before the alert pick starts.
    expect(screen.getByRole('button', { name: bookableDayName(10) })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: 'Stop picking dates' }));

    // The first tap committed nothing: the previous window is still the window.
    expect(screen.getByText(`Watching ${formatDateRange(isoDay(10), isoDay(17), 'en')}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: soldOutDayName(5) }).className).not.toContain('range-pending');
    // The calendar is back to booking, on the same day it was selecting before.
    expect(screen.getByRole('button', { name: soldOutDayName(20) })).toBeDisabled();
    expect(screen.getByRole('button', { name: bookableDayName(10) })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('These dates come from the calendar below.');

    // Booking behaviour is untouched: the bookable day still selects for purchase.
    await user.click(screen.getByRole('button', { name: bookableDayName(10) }));

    expect(screen.getByRole('button', { name: bookableDayName(10) })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends the calendar-picked range with the token it binds', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockClear();
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: rangeEndDayName(12) }));

    // The finished window brings the one action with it.
    expect(telegramCtas()).toHaveLength(1);
    signInWithTelegram();

    await waitFor(() =>
      expect(createTelegramAlertLink).toHaveBeenCalledWith({
        fromId: '7',
        toId: '4',
        dateFrom: isoDay(5),
        dateTo: isoDay(12),
        locale: 'en',
      }),
    );
  });

  it('shows already-available copy and still allows subscribing when the selected range has tickets', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/?from=7&to=4&dateFrom=2026-07-31&dateTo=2026-07-31');

    render(<App />);

    expect(
      await screen.findByText('Some of these dates are already on sale — the alert covers the rest.'),
    ).toBeInTheDocument();
    expect(telegramCtas()).toHaveLength(1);
  });

  it('falls back to the normal app for manage URLs when the frontend alert flag is off', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(false);
    vi.mocked(loadManagedAlerts).mockClear();
    window.history.replaceState(null, '', '/en/alerts/manage?token=abc');

    render(<App />);

    expect(await screen.findByText('Flying now')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Manage alerts' })).not.toBeInTheDocument();
    expect(loadManagedAlerts).not.toHaveBeenCalled();
  });

  it('loads and shows managed subscriptions when the localized manage route is enabled', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadManagedAlerts).mockResolvedValueOnce({
      subscriptions: [
        {
          id: 'sub-1',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          status: 'active',
          matchingDates: ['2026-08-11', '2026-08-18'],
          lastAlertSentOn: '2026-07-04',
        },
      ],
    });
    window.history.replaceState(null, '', '/en/alerts/manage?token=abc');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Manage alerts' })).toBeInTheDocument();
    expect(loadManagedAlerts).toHaveBeenCalledWith('abc');
    expect(screen.getByText('Tbilisi (Natakhtari airport) -> Batumi')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01 - 2026-08-31')).toBeInTheDocument();
    expect(screen.getByText('2 matching dates')).toBeInTheDocument();
    expect(screen.getByText('Last alert: 2026-07-04')).toBeInTheDocument();
  });

  it('unsubscribes a managed subscription and marks it unsubscribed', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadManagedAlerts).mockResolvedValueOnce({
      subscriptions: [
        {
          id: 'sub-1',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          status: 'active',
          matchingDates: ['2026-08-11'],
          lastAlertSentOn: '2026-07-04',
        },
      ],
    });
    vi.mocked(unsubscribeManagedAlert).mockResolvedValueOnce({ ok: true });
    window.history.replaceState(null, '', '/en/alerts/manage?token=abc');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Manage alerts' });
    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }));

    await waitFor(() =>
      expect(unsubscribeManagedAlert).toHaveBeenCalledWith({
        id: 'sub-1',
        token: 'abc',
      }),
    );
    expect(await screen.findByText('Unsubscribed')).toBeInTheDocument();
  });

  it('requests a manage link from the public entry and shows a generic success message', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(requestManageLink).mockResolvedValueOnce({ ok: true });
    window.history.replaceState(null, '', '/en/alerts/manage');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Manage alerts' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a manage link' }));

    await waitFor(() =>
      expect(requestManageLink).toHaveBeenCalledWith({
        email: 'a@example.com',
        locale: 'en',
      }),
    );
    expect(await screen.findByText('If that email has alerts, we sent a manage link.')).toBeInTheDocument();
  });

  it('still shows a generic success message when the manage-link request rejects', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(requestManageLink).mockRejectedValueOnce(new Error('boom'));
    window.history.replaceState(null, '', '/en/alerts/manage');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Manage alerts' });
    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a manage link' }));

    await waitFor(() =>
      expect(requestManageLink).toHaveBeenCalledWith({
        email: 'a@example.com',
        locale: 'en',
      }),
    );
    expect(await screen.findByText('If that email has alerts, we sent a manage link.')).toBeInTheDocument();
  });

  it('shows a manage-page error state when managed alerts fail to load', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadManagedAlerts).mockRejectedValueOnce(new Error('boom'));
    window.history.replaceState(null, '', '/en/alerts/manage?token=abc');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Manage alerts' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load alerts. Try the link again.');
  });

  it('shows an announced empty state when managed alerts load with no subscriptions', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadManagedAlerts).mockResolvedValueOnce({ subscriptions: [] });
    window.history.replaceState(null, '', '/en/alerts/manage?token=abc');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Manage alerts' })).toBeInTheDocument();
    const emptyState = await screen.findByText('No alerts found for this link.');
    expect(emptyState).toHaveAttribute('role', 'status');
  });

  it('mints a token and binds it with the signed Telegram identity, with no deep link opened', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockClear();
    vi.mocked(bindTelegramLogin).mockClear();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    expect(telegramCtas()).toHaveLength(1);

    signInWithTelegram();

    await waitFor(() =>
      expect(createTelegramAlertLink).toHaveBeenCalledWith({
        fromId: '7',
        toId: '4',
        dateFrom: '2026-07-31',
        dateTo: '2026-08-07',
        locale: 'en',
      }),
    );
    await waitFor(() =>
      expect(bindTelegramLogin).toHaveBeenCalledWith({ token: 'token-1', user: telegramWidgetUser }),
    );
    // The primary path never leaves the page for a deep link.
    expect(openSpy).not.toHaveBeenCalled();
    expect(await screen.findByText(/Alerts are on for Jul 31 – Aug 7/)).toBeInTheDocument();
    // The success state replaces the action instead of adding a second one.
    expect(telegramCtas()).toHaveLength(0);
    openSpy.mockRestore();
  });

  it('offers the new-chat fallback, and only that, when Telegram may not message the user yet', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(bindTelegramLogin).mockResolvedValueOnce({
      needsStart: true,
      startUrl: 'https://t.me/get_flights_ge_bot',
    });
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    signInWithTelegram();

    const fallback = await screen.findByRole('link', { name: /Open the bot/ });
    expect(fallback).toHaveAttribute('href', 'https://t.me/get_flights_ge_bot');
    // A bare bot link: the binding already happened, so it carries no token.
    expect(fallback.getAttribute('href')).not.toContain('start=');
    expect(
      screen.getByText('Almost there — open the bot once and press Start so it may message you.'),
    ).toBeInTheDocument();
    // Still exactly one Telegram action: the fallback took the widget's place.
    expect(telegramCtas()).toHaveLength(1);
  });

  it('shows an error and binds nothing when the token request fails', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(bindTelegramLogin).mockClear();
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    signInWithTelegram();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not turn the alert on. Try again.');
    expect(bindTelegramLogin).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Open the bot/ })).not.toBeInTheDocument();
    // The action stays available so the traveller can try again.
    expect(telegramCtas()).toHaveLength(1);
  });

  it('shows an error and no subscription when the Telegram binding is rejected', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(bindTelegramLogin).mockRejectedValueOnce(new Error('401'));
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    signInWithTelegram();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not turn the alert on. Try again.');
    expect(screen.queryByText(/Alerts are on for/)).not.toBeInTheDocument();
  });

  // Without the stage flags the widget has nothing to mount, so no Telegram
  // action is offered at all — the deep link never becomes the primary path.
  it('offers no Telegram action when the sign-in widget is not enabled for this build', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(readTelegramLoginConfig).mockReturnValue({ enabled: false, botUsername: null });
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });

    expect(telegramCtas()).toHaveLength(0);
    expect(screen.getByText('Telegram sign-in is not available in this environment.')).toBeInTheDocument();
  });

  it('offers no Telegram action while the selected alert route is invalid in the loaded snapshot', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockClear();
    vi.mocked(loadAvailabilitySnapshot).mockImplementationOnce(
      () =>
        new Promise(() => {
          // keep loading pending so invalid query params cannot race into a bind
        }),
    );
    window.history.replaceState(null, '', '/en/?from=4&to=5&dateFrom=2026-08-01&dateTo=2026-08-31');
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Set up an alert' }));

    expect(telegramCtas()).toHaveLength(0);
    expect(createTelegramAlertLink).not.toHaveBeenCalled();
  });

  it('drops the stale binding result when the alert range changes', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    signInWithTelegram();

    expect(await screen.findByText(/Alerts are on for/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: rangeEndDayName(12) }));

    // A new window is a new subscription: the old confirmation must not stand
    // in for it, and the action comes back for the new one.
    await waitFor(() => expect(screen.queryByText(/Alerts are on for/)).not.toBeInTheDocument());
    expect(telegramCtas()).toHaveLength(1);
  });
});
