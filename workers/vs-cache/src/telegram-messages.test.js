import { describe, expect, it } from 'vitest';
import {
  renderTelegramAlertMessage,
  renderTelegramHelpMessage,
  renderTelegramInvalidTokenMessage,
  renderTelegramListMessage,
  renderTelegramStopMessage,
  renderTelegramSubscribedMessage,
  telegramMessageLocales,
} from './telegram-messages.js';

const subscription = {
  routeLabel: 'Tbilisi (Natakhtari airport) → Batumi',
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  searchUrl: 'https://getflights.ge/en/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31',
};

// parse_mode=HTML means the query separators must reach Telegram escaped.
const escapedSearchUrl = subscription.searchUrl.replaceAll('&', '&amp;');

describe('telegram bot copy', () => {
  it('covers every supported app locale', () => {
    expect([...telegramMessageLocales].sort()).toEqual(['en', 'ka', 'ru', 'ua']);
  });

  it('renders a localized subscription confirmation per locale', () => {
    const rendered = telegramMessageLocales.map((locale) =>
      renderTelegramSubscribedMessage({ ...subscription, locale }),
    );

    for (const text of rendered) {
      expect(text).toContain('2026-08-01');
      expect(text).toContain(escapedSearchUrl);
      expect(text.length).toBeGreaterThan(0);
    }
    expect(new Set(rendered).size).toBe(telegramMessageLocales.length);
  });

  it('lists the matching dates and the search link in an alert', () => {
    const text = renderTelegramAlertMessage({
      ...subscription,
      locale: 'en',
      matchingDates: ['2026-08-03', '2026-08-11'],
    });

    expect(text).toContain('2026-08-03');
    expect(text).toContain('2026-08-11');
    expect(text).toContain(`href="${escapedSearchUrl}"`);
    expect(text).toContain('/stop');
  });

  it('escapes HTML coming from route labels', () => {
    const text = renderTelegramAlertMessage({
      ...subscription,
      routeLabel: '<b>evil</b> & co',
      locale: 'en',
      matchingDates: ['2026-08-03'],
    });

    expect(text).toContain('&lt;b&gt;evil&lt;/b&gt; &amp; co');
    expect(text).not.toContain('<b>evil</b>');
  });

  it('falls back to English for an unknown locale', () => {
    expect(renderTelegramSubscribedMessage({ ...subscription, locale: 'zz' })).toBe(
      renderTelegramSubscribedMessage({ ...subscription, locale: 'en' }),
    );
  });

  it('renders stop, list, help and invalid-token replies', () => {
    expect(renderTelegramStopMessage({ locale: 'en', count: 2 })).toContain('2');
    expect(renderTelegramStopMessage({ locale: 'en', count: 0 })).toEqual(expect.any(String));
    expect(
      renderTelegramListMessage({
        locale: 'en',
        subscriptions: [{ routeLabel: 'A → B', dateFrom: '2026-08-01', dateTo: '2026-08-31' }],
      }),
    ).toContain('A → B');
    expect(renderTelegramListMessage({ locale: 'en', subscriptions: [] })).toEqual(expect.any(String));
    expect(renderTelegramHelpMessage({ locale: 'en' })).toContain('/stop');
    expect(renderTelegramInvalidTokenMessage({ locale: 'en', siteUrl: 'https://getflights.ge/en/' })).toContain(
      'https://getflights.ge/en/',
    );
  });
});
