const knownCityIds = new Set(['1', '2', '4', '5', '6', '7']);
const supportedLocales = new Set(['en', 'ru', 'ua', 'ka']);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = 24 * 60 * 60 * 1000;
const maxRangeDays = 90;
const productDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tbilisi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function defaultAlertRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const day = now.getUTCDate();
  const target = day <= 7 ? new Date(Date.UTC(year, monthIndex, 1)) : new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    dateFrom: toIsoDate(target),
    dateTo: toIsoDate(endOfMonth(target)),
  };
}

export function normalizeAlertSubscriptionInput(value) {
  if (!value || typeof value !== 'object') return null;

  const email = normalizeEmail(value.email);
  const fromId = normalizeId(value.fromId);
  const toId = normalizeId(value.toId);
  const dateFrom = normalizeIsoDate(value.dateFrom);
  const dateTo = normalizeIsoDate(value.dateTo);
  const locale = typeof value.locale === 'string' ? value.locale.trim().toLowerCase() : '';

  if (!email || !fromId || !toId || !dateFrom || !dateTo) return null;
  if (!supportedLocales.has(locale)) return null;
  if (!knownCityIds.has(fromId) || !knownCityIds.has(toId) || fromId === toId) return null;
  if (dateFrom > dateTo) return null;
  if (dateRangeDays(dateFrom, dateTo) > maxRangeDays) return null;

  return {
    email,
    fromId,
    toId,
    dateFrom,
    dateTo,
    locale,
  };
}

export function findMatchingDates({ availability, fromId, toId, dateFrom, dateTo }) {
  const route = availability?.[routeKey(fromId, toId)];
  if (!route || !Array.isArray(route.outbound)) return [];
  return [...new Set(route.outbound.filter((date) => isoDatePattern.test(date) && date >= dateFrom && date <= dateTo))].sort();
}

export function alertProductDay(now = new Date()) {
  return productDayFormatter.format(now);
}

export function shouldSendDailyAlert({ lastAlertSentOn, productDay, matchingDates }) {
  return Array.isArray(matchingDates) && matchingDates.length > 0 && lastAlertSentOn !== productDay;
}

export async function hashAlertToken(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function routeKey(fromId, toId) {
  return `${fromId}:${toId}`;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return knownCityIds.has(id) ? id : null;
}

function normalizeIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = isoDatePattern.exec(value);
  if (!match) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const normalized = toIsoDate(parsed);
  return normalized === value ? normalized : null;
}

function dateRangeDays(dateFrom, dateTo) {
  const from = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
  const to = new Date(`${dateTo}T00:00:00.000Z`).getTime();
  return Math.floor((to - from) / dayMs) + 1;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}
