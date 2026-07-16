import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSearchFields,
  getOfficialPurchaseAction,
  getOfficialPurchaseRequest,
  loadAvailabilitySnapshot,
  parseFlightOptions,
  parseSearchForm,
  searchFlights,
} from './backend';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Drupal backend parsing', () => {
  it('loads the availability snapshot from the cached API endpoint', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET' });
        return Response.json({
          destinationMap: { '7': ['4'] },
          routeCatalog: [
            {
              from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
              destinations: [{ id: '4', name: 'Batumi' }],
            },
          ],
          availability: {
            '7:4': { outbound: ['2026-07-02'], returns: ['2026-07-03'] },
          },
          loadedAt: '2026-07-01T10:00:00.000Z',
          cacheStatus: 'hit',
        });
      }),
    );

    await expect(loadAvailabilitySnapshot()).resolves.toMatchObject({
      availability: {
        '7:4': { outbound: ['2026-07-02'], returns: ['2026-07-03'] },
      },
      loadedAt: '2026-07-01T10:00:00.000Z',
    });
    expect(requests).toEqual([{ url: '/api/availability', method: 'GET' }]);
  });

  it('posts manual availability refreshes to the cached refresh endpoint', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET' });
        return Response.json({
          destinationMap: {},
          routeCatalog: [],
          availability: {},
          loadedAt: '2026-07-01T10:01:00.000Z',
          cacheStatus: 'refreshed',
        });
      }),
    );

    await loadAvailabilitySnapshot(undefined, undefined, { refresh: true });

    expect(requests).toEqual([{ url: '/api/availability/refresh', method: 'POST' }]);
  });

  it('extracts the Drupal search form token needed for a backend search POST', () => {
    const html = `
      <form id="form-select-date" action="/en/tickets" method="post">
        <input type="hidden" name="form_build_id" value="form-abc123" />
        <input type="hidden" name="form_id" value="form_select_date" />
      </form>
    `;

    expect(parseSearchForm(html)).toEqual({
      action: '/en/tickets',
      formBuildId: 'form-abc123',
      formId: 'form_select_date',
    });
  });

  it('extracts selectable flight options from the backend result page', () => {
    const html = `
      <form id="form-select-flight" action="/en/flights-form" method="post">
        <article class="flight-item-bl">
          <span class="flight-city-name"><div>Batumi</div></span>
          <span class="flight-city-name"><div>Natakhtari</div></span>
          <div class="flight-item">
            <input id="check-0" type="checkbox" name="items[departure][0][container][check]" value="1" checked />
            <label for="check-0">
              <span class="flight-dates">
                <span class="flight-item-small">June 30</span>
                14:00
              </span>
              <span class="gel style-price-box">125GEL
                <span class="style-usd-price"> / 40USD</span>
              </span>
            </label>
          </div>
        </article>
      </form>
    `;

    expect(parseFlightOptions(html)).toEqual([
      {
        checkboxName: 'items[departure][0][container][check]',
        checkboxValue: '1',
        fromName: 'Batumi',
        toName: 'Natakhtari',
        dateLabel: 'June 30',
        time: '14:00',
        priceGel: '125GEL',
        priceUsd: '40USD',
      },
    ]);
  });

  it('builds the exact Drupal search fields needed to hand off to the official site', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T10:02:00.000Z'));

    const fields = buildSearchFields(
      {
        tripType: 'one-way',
        fromId: '4',
        toId: '7',
        outboundDate: '2026-06-30',
        passengers: {
          adult: 1,
          child: 0,
          infant: 0,
        },
      },
      {
        action: '/en/tickets',
        formBuildId: 'form-token',
        formId: 'form_select_date',
      },
    );

    expect(fields).toEqual({
      types: '0',
      departure: '4',
      date_picker: '2026-06-30',
      arrive: '7',
      date_picker_arrive: '07/01/2026',
      person_count: '1',
      'person_types[adult]': '1',
      'person_types[child]': '0',
      'person_types[infant]': '0',
      op: '',
      form_build_id: 'form-token',
      form_id: 'form_select_date',
    });
    expect(getOfficialPurchaseAction('/en/tickets')).toBe('https://ticket.vanillasky.ge/en/tickets');
  });

  it('rejects backend-derived purchase actions outside the official origin', () => {
    expect(getOfficialPurchaseAction('https://ticket.vanillasky.ge/ru/tickets')).toBe(
      'https://ticket.vanillasky.ge/ru/tickets',
    );
    expect(() => getOfficialPurchaseAction('https://attacker.example/collect')).toThrow(
      'Unsafe Vanilla Sky form action.',
    );
    expect(() => getOfficialPurchaseAction('//attacker.example/collect')).toThrow(
      'Unsafe Vanilla Sky form action.',
    );
    expect(() => getOfficialPurchaseAction('http://ticket.vanillasky.ge/en/tickets')).toThrow(
      'Unsafe Vanilla Sky form action.',
    );
  });

  it('loads the Russian official search form for a Russian booking handoff', async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        requests.push(String(url));
        return new Response(`
          <form id="form-select-date" action="/ru/tickets" method="post">
            <input type="hidden" name="form_build_id" value="form-ru" />
            <input type="hidden" name="form_id" value="form_select_date" />
          </form>
        `);
      }),
    );

    const request = await getOfficialPurchaseRequest({
      tripType: 'one-way',
      fromId: '4',
      toId: '7',
      outboundDate: '2026-06-30',
      officialLocale: 'ru',
      passengers: {
        adult: 1,
        child: 0,
        infant: 0,
      },
    });

    expect(requests).toEqual(['/vs-backend/ru/tickets']);
    expect(request.action).toBe('https://ticket.vanillasky.ge/ru/tickets');
    expect(request.fields.form_build_id).toBe('form-ru');
  });

  it('loads selected-day flight results from the cached API endpoint without sending browser cookies', async () => {
    const requests: Array<{ url: string; method: string; credentials?: RequestCredentials }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init?: RequestInit) => {
        requests.push({ url: String(url), method: init?.method ?? 'GET', credentials: init?.credentials });

        return Response.json({
          resultUrl: '/ru/tickets',
          loadedAt: '2026-07-01T10:02:00.000Z',
          cacheStatus: 'refreshed',
          html: `
            <form id="form-select-flight" action="/ru/flights-form" method="post">
              <article class="flight-item-bl">
                <span class="flight-city-name"><div>Batumi</div></span>
                <span class="flight-city-name"><div>Natakhtari</div></span>
                <div class="flight-item">
                  <input type="checkbox" name="items[departure][0][container][check]" value="1" checked />
                  <label>
                    <span class="flight-dates">
                      <span class="flight-item-small">June 30</span>
                      14:00
                    </span>
                    <span class="gel style-price-box">125GEL
                      <span class="style-usd-price"> / 40USD</span>
                    </span>
                  </label>
                </div>
              </article>
            </form>
          `,
        });
      }),
    );

    const result = await searchFlights({
      tripType: 'one-way',
      fromId: '4',
      toId: '7',
      outboundDate: '2026-06-30',
      officialLocale: 'ru',
      passengers: {
        adult: 1,
        child: 0,
        infant: 0,
      },
    });

    expect(requests).toEqual([
      {
        url: '/api/flights?tripType=one-way&fromId=4&toId=7&outboundDate=2026-06-30&adult=1&child=0&infant=0',
        method: 'GET',
        credentials: 'omit',
      },
    ]);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]).toMatchObject({
      time: '14:00',
      priceGel: '125GEL',
      priceUsd: '40USD',
    });
  });
});
