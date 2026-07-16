import { getRouteSeoPageByPath, routeSeoPagesForLocale } from '../../src/lib/route-seo.ts';

const locales = ['en', 'ru', 'ua', 'ka'];
const DETAIL_DATE_LIMIT = 5;
const LIST_DATE_LIMIT = 3;
const PATTERN_SAMPLE_LIMIT = 12;

// Hand-rolled date names (same convention as weekdayLabels in src/lib/i18n.ts):
// workerd's ICU build lacks Georgian locale data, so Intl-based formatting
// silently falls back to English there. Self-contained names render the same
// everywhere.
const weekdayShortBySunday = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  ua: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  ka: ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'],
};

const monthShort = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  ua: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
  ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
};

const monthLong = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  ua: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
  ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
};

const copyByLocale = {
  en: {
    listHeading: 'Upcoming Vanilla Sky flight dates',
    detailHeading: (from, to) => `Upcoming ${from} → ${to} flight dates`,
    updated: (date) => `Live availability from the official Vanilla Sky booking system, updated ${date}.`,
    nextDepartures: 'Next departures',
    fliesOn: 'This route currently flies on',
    moreDates: (count) => `+${count} more dates`,
    noDatesDetail: 'No upcoming dates are currently bookable for this route. Check the reverse route or come back later — availability refreshes every few minutes.',
    noDatesRow: 'no upcoming dates',
    cta: 'Pick a date in the search above to see seats and continue to official Vanilla Sky booking.',
  },
  ru: {
    listHeading: 'Ближайшие даты рейсов Vanilla Sky',
    detailHeading: (from, to) => `Ближайшие даты рейсов ${from} — ${to}`,
    updated: (date) => `Живая доступность из официальной системы бронирования Vanilla Sky, обновлено ${date}.`,
    nextDepartures: 'Ближайшие вылеты',
    fliesOn: 'Сейчас этот маршрут летает по дням',
    moreDates: (count) => `и ещё ${count} дат`,
    noDatesDetail: 'Сейчас на этот маршрут нет доступных дат. Проверьте обратный маршрут или загляните позже — доступность обновляется каждые несколько минут.',
    noDatesRow: 'нет доступных дат',
    cta: 'Выберите дату в поиске выше, чтобы увидеть места и перейти к официальному бронированию Vanilla Sky.',
  },
  ua: {
    listHeading: 'Найближчі дати рейсів Vanilla Sky',
    detailHeading: (from, to) => `Найближчі дати рейсів ${from} — ${to}`,
    updated: (date) => `Жива наявність з офіційної системи бронювання Vanilla Sky, оновлено ${date}.`,
    nextDepartures: 'Найближчі вильоти',
    fliesOn: 'Зараз цей маршрут літає у дні',
    moreDates: (count) => `і ще ${count} дат`,
    noDatesDetail: 'Зараз на цей маршрут немає доступних дат. Перевірте зворотний маршрут або поверніться пізніше — наявність оновлюється кожні кілька хвилин.',
    noDatesRow: 'немає доступних дат',
    cta: 'Оберіть дату в пошуку вище, щоб побачити місця та перейти до офіційного бронювання Vanilla Sky.',
  },
  ka: {
    listHeading: 'Vanilla Sky-ის უახლოესი ფრენის თარიღები',
    detailHeading: (from, to) => `${from} → ${to} — უახლოესი ფრენის თარიღები`,
    updated: (date) => `ცოცხალი ხელმისაწვდომობა Vanilla Sky-ის ოფიციალური სისტემიდან, განახლდა ${date}.`,
    nextDepartures: 'უახლოესი გაფრენები',
    fliesOn: 'ამ მარშრუტზე ამჟამად ფრენებია დღეებში',
    moreDates: (count) => `და კიდევ ${count} თარიღი`,
    noDatesDetail: 'ამ მარშრუტზე ამჟამად ხელმისაწვდომი თარიღები არ არის. შეამოწმეთ უკუ მარშრუტი ან დაბრუნდით მოგვიანებით — ხელმისაწვდომობა ყოველ რამდენიმე წუთში ახლდება.',
    noDatesRow: 'თარიღები არ არის',
    cta: 'აირჩიეთ თარიღი ზემოთ ძიებაში, რომ ნახოთ ადგილები და გადახვიდეთ Vanilla Sky-ის ოფიციალურ დაჯავშნაზე.',
  },
};

export function resolveInjectionTarget(pathname) {
  const homeLocale = homeLocaleForPath(pathname);
  if (homeLocale) {
    return { kind: 'home', locale: homeLocale };
  }

  const page = getRouteSeoPageByPath(pathname);
  if (!page) return null;
  if (page.kind === 'route') {
    return { kind: 'route', locale: page.locale, page };
  }
  return { kind: 'hub', locale: page.locale, topic: page.topic };
}

export function buildLiveScheduleHtml(target, snapshot, now) {
  const availability = snapshot?.availability;
  if (!availability || typeof availability !== 'object') return null;

  const copy = copyByLocale[target.locale];
  const locale = target.locale;
  const todayIso = isoDateInGeorgia(now);
  const currentYear = todayIso.slice(0, 4);
  const updatedLine = copy.updated(formatUpdatedDate(snapshot.loadedAt, locale, now));

  if (target.kind === 'route') {
    return buildRouteDetail(target.page, availability, copy, locale, todayIso, currentYear, updatedLine);
  }

  const routePages = routeSeoPagesForLocale(locale).filter((page) => page.kind === 'route');
  const listedPages =
    target.kind === 'hub' && target.topic === 'natakhtari'
      ? routePages.filter((page) => page.route.fromId === '7' || page.route.toId === '7')
      : routePages;

  return buildRouteList(listedPages, availability, copy, locale, todayIso, currentYear, updatedLine);
}

function buildRouteDetail(page, availability, copy, locale, todayIso, currentYear, updatedLine) {
  const dates = upcomingDates(availability, page.route.fromId, page.route.toId, todayIso);
  if (dates === null) return null;

  let body;
  if (dates.length === 0) {
    body = `<p>${escapeHtml(copy.noDatesDetail)}</p>`;
  } else {
    const shown = dates
      .slice(0, DETAIL_DATE_LIMIT)
      .map((iso) => formatFlightDate(iso, locale, currentYear, { weekday: true }));
    const remaining = dates.length - DETAIL_DATE_LIMIT;
    const more = remaining > 0 ? ` (${copy.moreDates(remaining)})` : '';
    const pattern = weekdayPattern(dates, locale);
    const patternItem = pattern ? `<li>${escapeHtml(copy.fliesOn)}: ${escapeHtml(pattern)}</li>` : '';
    body = `<ul>
        <li>${escapeHtml(copy.nextDepartures)}: ${escapeHtml(shown.join('; '))}${escapeHtml(more)}</li>
        ${patternItem}
      </ul>
      <p>${escapeHtml(copy.cta)}</p>`;
  }

  return `<section class="seo-live-schedule">
      <h2>${escapeHtml(copy.detailHeading(page.route.publicFrom, page.route.publicTo))}</h2>
      <p>${escapeHtml(updatedLine)}</p>
      ${body}
    </section>`;
}

function buildRouteList(pages, availability, copy, locale, todayIso, currentYear, updatedLine) {
  let datedRoutes = 0;
  const rows = pages.map((page) => {
    const dates = upcomingDates(availability, page.route.fromId, page.route.toId, todayIso) ?? [];
    const label = `${page.route.publicFrom} → ${page.route.publicTo}`;
    let summary;
    if (dates.length === 0) {
      summary = copy.noDatesRow;
    } else {
      datedRoutes += 1;
      const shown = dates.slice(0, LIST_DATE_LIMIT).map((iso) => formatFlightDate(iso, locale, currentYear));
      const remaining = dates.length - LIST_DATE_LIMIT;
      summary = remaining > 0 ? `${shown.join(', ')} (${copy.moreDates(remaining)})` : shown.join(', ');
    }
    return `<li><a href="${escapeHtml(page.path)}">${escapeHtml(label)}</a>: ${escapeHtml(summary)}</li>`;
  });

  if (datedRoutes === 0) return null;

  return `<section class="seo-live-schedule">
      <h2>${escapeHtml(copy.listHeading)}</h2>
      <p>${escapeHtml(updatedLine)}</p>
      <ul>
        ${rows.join('\n        ')}
      </ul>
      <p>${escapeHtml(copy.cta)}</p>
    </section>`;
}

function homeLocaleForPath(pathname) {
  if (pathname === '/') return 'en';
  const match = pathname.match(/^\/([a-z]{2})\/?$/);
  return match && locales.includes(match[1]) ? match[1] : null;
}

function upcomingDates(availability, fromId, toId, todayIso) {
  const entry = availability[`${fromId}:${toId}`];
  if (!entry || !Array.isArray(entry.outbound)) return null;
  return entry.outbound.filter((iso) => typeof iso === 'string' && iso >= todayIso);
}

function weekdayPattern(dates, locale) {
  const sample = dates.slice(0, PATTERN_SAMPLE_LIMIT);
  if (sample.length < 3) return null;

  const seenWeekdays = new Set(sample.map((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay()));
  if (seenWeekdays.size > 5) return null;

  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  return mondayFirst
    .filter((weekday) => seenWeekdays.has(weekday))
    .map((weekday) => weekdayShortBySunday[locale][weekday])
    .join(', ');
}

function isoDateInGeorgia(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function formatFlightDate(iso, locale, currentYear, { weekday = false } = {}) {
  const [year, month, day] = iso.split('-').map(Number);
  const core = locale === 'en' ? `${monthShort.en[month - 1]} ${day}` : `${day} ${monthShort[locale][month - 1]}`;
  const withYear =
    String(year) === currentYear ? core : locale === 'en' ? `${core}, ${year}` : `${core} ${year}`;
  if (!weekday) return withYear;
  const weekdayName = weekdayShortBySunday[locale][new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return `${weekdayName}, ${withYear}`;
}

function formatUpdatedDate(loadedAt, locale, now) {
  const parsed = loadedAt ? new Date(loadedAt) : now;
  const date = Number.isNaN(parsed.getTime()) ? now : parsed;
  const [year, month, day] = isoDateInGeorgia(date).split('-').map(Number);
  if (locale === 'en') return `${monthLong.en[month - 1]} ${day}, ${year}`;
  if (locale === 'ka') return `${day} ${monthLong.ka[month - 1]}, ${year}`;
  return `${day} ${monthLong[locale][month - 1]} ${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
