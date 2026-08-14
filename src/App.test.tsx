import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import {
  loadManagedAlerts,
  readAlertsEnabled,
  requestManageLink,
  subscribeToRouteAlerts,
  unsubscribeManagedAlert,
} from './lib/alerts';
import { getOfficialPurchaseRequest, loadAvailabilitySnapshot, searchFlights } from './lib/backend';
import { LOCALE_STORAGE_KEY } from './lib/i18n';

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
  defaultAlertRange: vi.fn(() => ({
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
  })),
  subscribeToRouteAlerts: vi.fn(async () => ({ ok: true })),
  requestManageLink: vi.fn(async () => ({ ok: true })),
  loadManagedAlerts: vi.fn(async () => ({ subscriptions: [] })),
  unsubscribeManagedAlert: vi.fn(async () => ({ ok: true })),
  buildAlertReturnUrl: vi.fn(() => '/en/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31'),
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

    expect(screen.queryByRole('heading', { name: 'Notify me about tickets' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: 'Notify me about tickets' })).not.toBeInTheDocument();
  });

  it('shows a compact notify panel with route range controls when alerts are enabled', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Notify me about tickets' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('To date')).toHaveValue('2026-08-31');
    expect(screen.getByRole('button', { name: 'This month' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage alerts' })).toBeInTheDocument();
  });

  it('preselects route and range from query params when alerts are enabled', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/?from=6&to=5&dateFrom=2026-07-01&dateTo=2026-07-31');

    render(<App />);

    expect(await screen.findByRole('button', { name: /Select route Mestia to Kutaisi/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('From date')).toHaveValue('2026-07-01');
    expect(screen.getByLabelText('To date')).toHaveValue('2026-07-31');
  });

  it('shows already-available copy and still allows subscribing when the selected range has tickets', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    window.history.replaceState(null, '', '/en/?from=7&to=4&dateFrom=2026-07-31&dateTo=2026-07-31');

    render(<App />);

    expect(await screen.findByText('Tickets are already available for this range.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notify me' })).toBeEnabled();
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

  it('shows the check-email state after a successful subscription', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(subscribeToRouteAlerts).mockResolvedValueOnce({ ok: true });
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Notify me about tickets' });
    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Notify me' }));

    await waitFor(() =>
      expect(subscribeToRouteAlerts).toHaveBeenCalledWith({
        email: 'a@example.com',
        fromId: '7',
        toId: '4',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        locale: 'en',
      }),
    );
    expect(await screen.findByText('Check your email to confirm this alert.')).toBeInTheDocument();
  });

  it('does not subscribe while the selected alert route is invalid in the loaded snapshot', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(subscribeToRouteAlerts).mockClear();
    vi.mocked(loadAvailabilitySnapshot).mockImplementationOnce(
      () =>
        new Promise(() => {
          // keep loading pending so invalid query params cannot race into a submit
        }),
    );
    window.history.replaceState(null, '', '/en/?from=999&to=888&dateFrom=2026-08-01&dateTo=2026-08-31');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Notify me about tickets' })).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Notify me' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Email'), 'a@example.com');

    expect(screen.getByRole('button', { name: 'Notify me' })).toBeDisabled();
    expect(subscribeToRouteAlerts).not.toHaveBeenCalled();
  });

  it('clears the check-email state when the alert range changes after a successful subscription', async () => {
    vi.mocked(readAlertsEnabled).mockReturnValue(true);
    vi.mocked(subscribeToRouteAlerts).mockResolvedValueOnce({ ok: true });
    window.history.replaceState(null, '', '/en/');
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Notify me about tickets' });
    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Notify me' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Check your email to confirm this alert.');

    await user.clear(screen.getByLabelText('From date'));
    await user.type(screen.getByLabelText('From date'), '2026-08-02');

    await waitFor(() =>
      expect(screen.queryByText('Check your email to confirm this alert.')).not.toBeInTheDocument(),
    );
  });
});
