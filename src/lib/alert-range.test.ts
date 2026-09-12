import { describe, expect, it } from 'vitest';
import {
  ALERT_RANGE_DEFAULT_DAYS,
  addDays,
  alertRangeFromDate,
  hasDatesInRange,
  isIsoDate,
  isSelectableAlertRangeEnd,
  isValidAlertRange,
  monthAlertRange,
  todayIso,
} from './alert-range';

describe('alertRangeFromDate', () => {
  it('defaults to the selected date through the following week', () => {
    expect(ALERT_RANGE_DEFAULT_DAYS).toBe(7);
    expect(alertRangeFromDate('2026-07-31')).toEqual({ dateFrom: '2026-07-31', dateTo: '2026-08-07' });
  });

  it('rolls over months, years and leap days', () => {
    expect(alertRangeFromDate('2026-12-28')).toEqual({ dateFrom: '2026-12-28', dateTo: '2027-01-04' });
    expect(alertRangeFromDate('2028-02-26')).toEqual({ dateFrom: '2028-02-26', dateTo: '2028-03-04' });
  });

  it('accepts a custom window', () => {
    expect(alertRangeFromDate('2026-07-31', 0)).toEqual({ dateFrom: '2026-07-31', dateTo: '2026-07-31' });
    expect(alertRangeFromDate('2026-07-31', 30)).toEqual({ dateFrom: '2026-07-31', dateTo: '2026-08-30' });
  });

  it('leaves an unparseable date untouched rather than producing NaN', () => {
    expect(addDays('not-a-date', 7)).toBe('not-a-date');
  });
});

describe('isIsoDate / isValidAlertRange', () => {
  it('accepts only well-formed ISO dates', () => {
    expect(isIsoDate('2026-07-31')).toBe(true);
    expect(isIsoDate('2026-7-31')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it('requires both ends and a non-inverted order', () => {
    expect(isValidAlertRange('2026-07-31', '2026-08-07')).toBe(true);
    expect(isValidAlertRange('2026-07-31', '2026-07-31')).toBe(true);
    expect(isValidAlertRange('2026-08-07', '2026-07-31')).toBe(false);
    expect(isValidAlertRange('2026-07-31', null)).toBe(false);
    expect(isValidAlertRange(null, '2026-08-07')).toBe(false);
  });
});

describe('monthAlertRange', () => {
  it('spans the whole calendar month', () => {
    expect(monthAlertRange(2026, 6)).toEqual({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });
    expect(monthAlertRange(2026, 1)).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' });
    expect(monthAlertRange(2028, 1)).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' });
  });
});

describe('todayIso', () => {
  it('formats the local calendar day, zero padded', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('hasDatesInRange', () => {
  const dates = ['2026-07-31', '2026-08-03', '2026-08-05'];

  it('reports an inclusive overlap', () => {
    expect(hasDatesInRange(dates, '2026-07-31', '2026-08-07')).toBe(true);
    expect(hasDatesInRange(dates, '2026-08-05', '2026-08-05')).toBe(true);
  });

  it('reports no overlap outside the range or for an invalid range', () => {
    expect(hasDatesInRange(dates, '2026-08-06', '2026-08-20')).toBe(false);
    expect(hasDatesInRange(dates, '2026-08-07', '2026-07-31')).toBe(false);
    expect(hasDatesInRange([], '2026-07-31', '2026-08-07')).toBe(false);
  });
});

describe('isSelectableAlertRangeEnd', () => {
  it('offers every valid day while no start is fixed yet', () => {
    expect(isSelectableAlertRangeEnd('2026-07-01', null)).toBe(true);
    expect(isSelectableAlertRangeEnd('2026-07-31', null)).toBe(true);
  });

  it('offers only days strictly after the fixed start', () => {
    expect(isSelectableAlertRangeEnd('2026-07-11', '2026-07-10')).toBe(true);
    expect(isSelectableAlertRangeEnd('2026-08-01', '2026-07-10')).toBe(true);
  });

  it('refuses the start day itself and anything before it', () => {
    expect(isSelectableAlertRangeEnd('2026-07-10', '2026-07-10')).toBe(false);
    expect(isSelectableAlertRangeEnd('2026-07-09', '2026-07-10')).toBe(false);
    expect(isSelectableAlertRangeEnd('2026-06-30', '2026-07-10')).toBe(false);
  });

  it('refuses anything that is not an ISO date', () => {
    expect(isSelectableAlertRangeEnd('not-a-date', '2026-07-10')).toBe(false);
    expect(isSelectableAlertRangeEnd('', null)).toBe(false);
  });
});
