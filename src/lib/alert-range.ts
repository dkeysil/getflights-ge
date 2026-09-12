export type AlertRange = {
  dateFrom: string;
  dateTo: string;
};

// The alert window the UI offers by default: the day the traveller picked plus
// the week after it. Short enough that the bot stays relevant, wide enough that
// a route which sells in bursts still has a chance to match.
export const ALERT_RANGE_DEFAULT_DAYS = 7;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && isoDatePattern.test(value);
}

export function isValidAlertRange(dateFrom: string | null | undefined, dateTo: string | null | undefined) {
  return isIsoDate(dateFrom) && isIsoDate(dateTo) && dateFrom <= dateTo;
}

// Shifted in UTC so a DST boundary in the viewer's zone cannot move the day.
export function addDays(iso: string, days: number) {
  if (!isIsoDate(iso)) return iso;

  const [year, month, day] = iso.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

// The alert window is picked forwards only: once the start is fixed, the end
// has to be a strictly later day. A same-day pick would read as a completed
// range on the calendar while meaning "not finished yet", so it is not offered.
export function isSelectableAlertRangeEnd(iso: string, start: string | null) {
  if (!isIsoDate(iso)) return false;
  if (!isIsoDate(start)) return true;
  return iso > start;
}

export function alertRangeFromDate(iso: string, days = ALERT_RANGE_DEFAULT_DAYS): AlertRange {
  return { dateFrom: iso, dateTo: addDays(iso, days) };
}

export function monthAlertRange(year: number, monthIndex: number): AlertRange {
  return {
    dateFrom: `${year}-${pad(monthIndex + 1)}-01`,
    dateTo: `${year}-${pad(monthIndex + 1)}-${pad(new Date(year, monthIndex + 1, 0).getDate())}`,
  };
}

// Local, not UTC: "today" has to agree with the day the calendar highlights.
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function hasDatesInRange(dates: string[], dateFrom: string, dateTo: string) {
  if (!isValidAlertRange(dateFrom, dateTo)) return false;
  return dates.some((date) => date >= dateFrom && date <= dateTo);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
