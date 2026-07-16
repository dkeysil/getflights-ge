import { describe, expect, it } from 'vitest';
import {
  alertProductDay,
  defaultAlertRange,
  findMatchingDates,
  hashAlertToken,
  normalizeAlertSubscriptionInput,
  shouldSendDailyAlert,
} from './alerts-domain.js';

describe('alert domain helpers', () => {
  it('suggests the current month during the first week and next month afterward', () => {
    expect(defaultAlertRange(new Date('2026-07-05T12:00:00.000Z'))).toEqual({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });
    expect(defaultAlertRange(new Date('2026-07-08T12:00:00.000Z'))).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('normalizes valid subscription input and rejects invalid route, dates, range, and locale', () => {
    expect(normalizeAlertSubscriptionInput({
      email: ' User@Example.COM ',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: ' UA ',
    })).toMatchObject({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'ua',
    });
    expect(normalizeAlertSubscriptionInput({ email: 'bad', fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '7', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-08-31', dateTo: '2026-08-01', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-11-15', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-02-30', dateTo: '2026-03-31', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-13-01', dateTo: '2026-03-01', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'de' })).toBeNull();
  });

  it('finds matching dates inside the subscription range', () => {
    expect(findMatchingDates({
      availability: { '7:4': { outbound: ['2026-07-31', '2026-08-01', '2026-08-15', '2026-09-01'] } },
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    })).toEqual(['2026-08-01', '2026-08-15']);
  });

  it('uses Asia/Tbilisi as the product day and gates duplicate daily sends', () => {
    expect(alertProductDay(new Date('2026-07-01T20:30:00.000Z'))).toBe('2026-07-02');
    expect(shouldSendDailyAlert({ lastAlertSentOn: null, productDay: '2026-07-02', matchingDates: ['2026-08-01'] })).toBe(true);
    expect(shouldSendDailyAlert({ lastAlertSentOn: '2026-07-02', productDay: '2026-07-02', matchingDates: ['2026-08-01'] })).toBe(false);
    expect(shouldSendDailyAlert({ lastAlertSentOn: '2026-07-01', productDay: '2026-07-02', matchingDates: [] })).toBe(false);
  });

  it('hashes tokens without returning the raw token', async () => {
    const hash = await hashAlertToken('secret-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('secret-token');
  });
});
