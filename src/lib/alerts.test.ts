import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alertsEnabled,
  buildAlertReturnUrl,
  defaultAlertRange,
  loadManagedAlerts,
  requestManageLink,
  subscribeToRouteAlerts,
  unsubscribeManagedAlert,
} from './alerts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('alert helpers', () => {
  it('reads the frontend alert flag from the VITE env value', () => {
    expect(alertsEnabled({ VITE_ALERTS_ENABLED: 'true' })).toBe(true);
    expect(alertsEnabled({})).toBe(false);
    expect(alertsEnabled({ VITE_ALERTS_ENABLED: '' })).toBe(false);
    expect(alertsEnabled({ VITE_ALERTS_ENABLED: 'false' })).toBe(false);
    expect(alertsEnabled({ VITE_ALERTS_ENABLED: '1' })).toBe(false);
  });

  it('suggests the current month during the first week and next month afterward', () => {
    expect(defaultAlertRange(new Date('2026-07-05T12:00:00Z'))).toEqual({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });
    expect(defaultAlertRange(new Date('2026-07-08T12:00:00Z'))).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('builds a return URL with the selected route and range query params', () => {
    const url = buildAlertReturnUrl({
      locale: 'en',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    expect(url).toContain('from=7');
    expect(url).toContain('to=4');
    expect(url).toContain('dateFrom=2026-08-01');
    expect(url).toContain('dateTo=2026-08-31');
  });

  it('posts route alert subscriptions to the subscribe endpoint', async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET', body: String(init?.body ?? '') });
        return Response.json({ ok: true });
      }),
    );

    await subscribeToRouteAlerts({
      email: 'a@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    expect(requests).toEqual([
      {
        url: '/api/alerts/subscribe',
        method: 'POST',
        body: JSON.stringify({
          email: 'a@example.com',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'en',
        }),
      },
    ]);
  });

  it('posts manage-link requests to the manage-link endpoint', async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET', body: String(init?.body ?? '') });
        return Response.json({ ok: true });
      }),
    );

    await requestManageLink({ email: 'a@example.com', locale: 'en' });

    expect(requests).toEqual([
      {
        url: '/api/alerts/manage-link',
        method: 'POST',
        body: JSON.stringify({
          email: 'a@example.com',
          locale: 'en',
        }),
      },
    ]);
  });

  it('loads managed alerts from the manage endpoint with a token query param', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET' });
        return Response.json({ subscriptions: [] });
      }),
    );

    await loadManagedAlerts('abc');

    expect(requests).toEqual([{ url: '/api/alerts/manage?token=abc', method: 'GET' }]);
  });

  it('posts unsubscribe requests with the manage token in the query string', async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET', body: String(init?.body ?? '') });
        return Response.json({ ok: true });
      }),
    );

    await unsubscribeManagedAlert({ id: 'sub-123', token: 'a b/c' });

    expect(requests).toEqual([
      {
        url: '/api/alerts/sub-123/unsubscribe?token=a%20b%2Fc',
        method: 'POST',
        body: '',
      },
    ]);
  });
});
