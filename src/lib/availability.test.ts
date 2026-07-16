import { describe, expect, it } from 'vitest';
import {
  buildMonthCalendar,
  buildPurchasableRouteCatalog,
  buildRouteCatalog,
  getRouteAvailability,
  normalizeFlightDates,
  type City,
} from './availability';

const cities: City[] = [
  { id: '1', name: 'Tbilisi' },
  { id: '4', name: 'Batumi' },
  { id: '7', name: 'Natakhtari' },
];

describe('route availability', () => {
  it('only exposes destinations returned by the backend route endpoint', () => {
    const catalog = buildRouteCatalog(cities, {
      '1': ['4'],
      '4': ['1', '7'],
      '7': ['4'],
    });

    expect(catalog.find((route) => route.from.id === '1')?.destinations).toEqual([
      { id: '4', name: 'Batumi' },
    ]);
    expect(catalog.find((route) => route.from.id === '1')?.destinations).not.toContainEqual({
      id: '7',
      name: 'Natakhtari',
    });
  });

  it('normalizes outbound and return dates into sorted unique lists', () => {
    const dates = normalizeFlightDates({
      to: ['2026-06-30', '2026-06-30', '2026-07-02'],
      from: ['2026-07-04', '2026-07-03'],
    });

    expect(dates).toEqual({
      outbound: ['2026-06-30', '2026-07-02'],
      returns: ['2026-07-03', '2026-07-04'],
    });
  });

  it('builds a calendar with available route dates marked in advance', () => {
    const availability = getRouteAvailability('4', '7', {
      '4:7': { outbound: ['2026-06-30', '2026-07-02'], returns: [] },
    });

    const calendar = buildMonthCalendar(2026, 5, availability.outbound);

    expect(calendar.availableDates).toEqual(['2026-06-30']);
    expect(calendar.weeks.flat().find((day) => day.iso === '2026-06-30')).toMatchObject({
      inCurrentMonth: true,
      isAvailable: true,
    });
    expect(calendar.weeks.flat().find((day) => day.iso === '2026-06-29')).toMatchObject({
      inCurrentMonth: true,
      isAvailable: false,
    });
  });

  it('formats the month label for the selected locale', () => {
    const calendar = buildMonthCalendar(2026, 5, ['2026-06-30'], 'ru');

    expect(calendar.monthLabel).toBe(
      new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(new Date(2026, 5, 1)),
    );
  });

  it('filters the route catalog to only routes with purchasable outbound dates', () => {
    const catalog = buildRouteCatalog(cities, {
      '1': ['4'],
      '4': ['1', '7'],
      '7': ['4'],
    });

    const purchasable = buildPurchasableRouteCatalog(catalog, {
      '1:4': { outbound: [], returns: [] },
      '4:1': { outbound: [], returns: [] },
      '4:7': { outbound: ['2026-06-30'], returns: [] },
      '7:4': { outbound: ['2026-07-01'], returns: [] },
    });

    expect(purchasable).toEqual([
      {
        from: { id: '4', name: 'Batumi' },
        destinations: [{ id: '7', name: 'Natakhtari' }],
      },
      {
        from: { id: '7', name: 'Natakhtari' },
        destinations: [{ id: '4', name: 'Batumi' }],
      },
    ]);
  });
});
