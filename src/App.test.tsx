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
    url: 'https://t.me/get_flights_ge_bot?start=token-1',
    expiresAt: '2026-08-01T10:15:00.000Z',
    matchingDates: [],
  })),
  isTelegramDeepLink: vi.fn(() => true),
}));

beforeEach(() => {
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
    expect(screen.queryByRole('button', { name: 'Get alerts in Telegram' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Get alerts in Telegram' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Get alerts in Telegram' })).toBeEnabled();

    expect(screen.getByText('Telegram opens so you can confirm — tap Start there and the alert is on.')).toBeInTheDocument();
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

    // The first click already shows as a one-day window and moves on to the end.
    expect(screen.getByText(`Watching ${formatDateRange(isoDay(5), isoDay(5), 'en')}`)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Now tap the last day to watch. The same day again watches a single day.',
    );

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

  it('closes the same inclusive range when the end day is clicked before the start day', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(20) }));
    await user.click(screen.getByRole('button', { name: rangeEndDayName(6) }));

    expect(
      screen.getByText(`Watching ${formatDateRange(isoDay(6), isoDay(20), 'en')}`),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: soldOutDayName(6) }).className).toContain('range-start');
    expect(screen.getByRole('button', { name: soldOutDayName(20) }).className).toContain('range-end');
  });

  it('hands the calendar back to booking when the pick is cancelled mid-range', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: 'Stop picking dates' }));

    // The first tap was only a preview. Cancelling must not turn it into an
    // unintended pinned one-day alert.
    expect(screen.getByText(`Watching ${formatDateRange(isoDay(10), isoDay(17), 'en')}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: soldOutDayName(20) })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('These dates come from the calendar below.');

    // Booking behaviour is untouched: the bookable day still selects for purchase.
    await user.click(screen.getByRole('button', { name: bookableDayName(10) }));

    expect(screen.getByRole('button', { name: bookableDayName(10) })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends the calendar-picked range to the Telegram deep-link request', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockClear();
    vi.mocked(loadAvailabilitySnapshot).mockResolvedValueOnce(currentMonthSnapshot(10));
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));
    await user.click(screen.getByRole('button', { name: rangeEndDayName(12) }));
    await user.click(screen.getByRole('button', { name: 'Get alerts in Telegram' }));

    await waitFor(() =>
      expect(createTelegramAlertLink).toHaveBeenCalledWith({
        fromId: '7',
        toId: '4',
        dateFrom: isoDay(5),
        dateTo: isoDay(12),
        locale: 'en',
      }),
    );
    openSpy.mockRestore();
  });

  it('shows already-available copy and still allows subscribing when the selected range has tickets', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/?from=7&to=4&dateFrom=2026-07-31&dateTo=2026-07-31');

    render(<App />);

    expect(
      await screen.findByText('Some of these dates are already on sale — the alert covers the rest.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get alerts in Telegram' })).toBeEnabled();
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

  it('opens the Telegram deep link for the selected route and range', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockClear();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Get alerts in Telegram' }));

    await waitFor(() =>
      expect(createTelegramAlertLink).toHaveBeenCalledWith({
        fromId: '7',
        toId: '4',
        dateFrom: '2026-07-31',
        dateTo: '2026-08-07',
        locale: 'en',
      }),
    );
    expect(openSpy).toHaveBeenCalledWith('https://t.me/get_flights_ge_bot?start=token-1', '_blank', 'noopener,noreferrer');
    expect(await screen.findByRole('link', { name: 'Open Telegram' })).toHaveAttribute(
      'href',
      'https://t.me/get_flights_ge_bot?start=token-1',
    );
    openSpy.mockRestore();
  });

  it('shows an error and no link when the Telegram link request fails', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockRejectedValueOnce(new Error('boom'));
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Get alerts in Telegram' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the Telegram link. Try again.');
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open Telegram' })).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('does not request a Telegram link while the selected alert route is invalid in the loaded snapshot', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(createTelegramAlertLink).mockClear();
    vi.mocked(loadAvailabilitySnapshot).mockImplementationOnce(
      () =>
        new Promise(() => {
          // keep loading pending so invalid query params cannot race into a submit
        }),
    );
    window.history.replaceState(null, '', '/en/?from=4&to=5&dateFrom=2026-08-01&dateTo=2026-08-31');
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Set up an alert' }));

    expect(screen.getByRole('button', { name: 'Get alerts in Telegram' })).toBeDisabled();
    expect(createTelegramAlertLink).not.toHaveBeenCalled();
  });

  it('drops the stale Telegram link when the alert range changes', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'No seats on sale for this day' });
    await user.click(screen.getByRole('button', { name: 'Get alerts in Telegram' }));

    expect(await screen.findByRole('link', { name: 'Open Telegram' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pick dates in the calendar' }));
    await user.click(screen.getByRole('button', { name: rangeStartDayName(5) }));

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Open Telegram' })).not.toBeInTheDocument());
    openSpy.mockRestore();
  });
});
