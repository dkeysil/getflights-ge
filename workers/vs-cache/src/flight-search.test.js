import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFlightSearchFields, fetchFlightSearch, parseSearchForm } from './flight-search.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('flight search cache loader', () => {
  it('parses official search form tokens without a browser DOM', () => {
    expect(
      parseSearchForm(`
        <form method="post" id="form-select-date" action="/ru/tickets">
          <input name="form_build_id" value="form-ru" />
          <input value="form_select_date" name="form_id" />
        </form>
      `),
    ).toEqual({
      action: '/ru/tickets',
      formBuildId: 'form-ru',
      formId: 'form_select_date',
    });
  });

  it('normalizes official absolute search form actions to backend paths', () => {
    expect(
      parseSearchForm(`
        <form method="post" id="form-select-date" action="https://ticket.vanillasky.ge/ru/tickets?foo=bar">
          <input name="form_build_id" value="form-ru" />
          <input value="form_select_date" name="form_id" />
        </form>
      `),
    ).toEqual({
      action: '/ru/tickets?foo=bar',
      formBuildId: 'form-ru',
      formId: 'form_select_date',
    });
  });

  it('rejects external search form actions before posting search data', () => {
    expect(() =>
      parseSearchForm(`
        <form method="post" id="form-select-date" action="https://attacker.example/collect">
          <input name="form_build_id" value="form-ru" />
          <input value="form_select_date" name="form_id" />
        </form>
      `),
    ).toThrow('Unsafe Vanilla Sky form action.');

    expect(() =>
      parseSearchForm(`
        <form method="post" id="form-select-date" action="//attacker.example/collect">
          <input name="form_build_id" value="form-ru" />
          <input value="form_select_date" name="form_id" />
        </form>
      `),
    ).toThrow('Unsafe Vanilla Sky form action.');
  });

  it('loads the official form, posts the search, and returns cacheable HTML', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T10:02:00.000Z'));
    const requests = [];
    const fetchText = async (path, init = {}) => {
      requests.push({ path, method: init.method ?? 'GET', body: String(init.body ?? '') });
      if (path.endsWith('/flights-form')) {
        return '<form id="form-select-flight"></form>';
      }

      if (!init.method) {
        return `
          <form id="form-select-date" action="/ru/tickets" method="post">
            <input type="hidden" name="form_build_id" value="form-ru" />
            <input type="hidden" name="form_id" value="form_select_date" />
          </form>
        `;
      }

      return '<form id="form-select-flight" action="/ru/flights-form" method="post"></form>';
    };

    const result = await fetchFlightSearch({
      fetchText,
      input: {
        tripType: 'one-way',
        fromId: '4',
        toId: '7',
        outboundDate: '2026-06-30',
        officialLocale: 'ru',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
      now: () => new Date('2026-07-01T10:02:00.000Z'),
    });

    expect(requests).toEqual([
      { path: '/ru/flights-form', method: 'GET', body: '' },
      { path: '/ru/tickets', method: 'GET', body: '' },
      {
        path: '/ru/tickets',
        method: 'POST',
        body: String(
          new URLSearchParams({
            ...buildFlightSearchFields(
              {
                tripType: 'one-way',
                fromId: '4',
                toId: '7',
                outboundDate: '2026-06-30',
                officialLocale: 'ru',
                passengers: { adult: 1, child: 0, infant: 0 },
              },
              {
                action: '/ru/tickets',
                formBuildId: 'form-ru',
                formId: 'form_select_date',
              },
            ),
          }),
        ),
      },
    ]);
    expect(result).toEqual({
      resultUrl: '/ru/tickets',
      html: '<form id="form-select-flight" action="/ru/flights-form" method="post"></form>',
      loadedAt: '2026-07-01T10:02:00.000Z',
    });
  });

  it('fills the one-way return date field with today because Vanilla Sky requires it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T10:02:00.000Z'));

    expect(
      buildFlightSearchFields(
        {
          tripType: 'one-way',
          fromId: '7',
          toId: '4',
          outboundDate: '2026-07-02',
          passengers: { adult: 1, child: 0, infant: 0 },
        },
        {
          action: '/ru/tickets',
          formBuildId: 'form-ru',
          formId: 'form_select_date',
        },
      ).date_picker_arrive,
    ).toBe('07/01/2026');
  });
});
