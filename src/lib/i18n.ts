export type Locale = 'en' | 'ru' | 'ua' | 'ka';
export type OfficialFormLocale = 'en' | 'ru';

export const LOCALE_STORAGE_KEY = 'vs-locale';

export const localeOptions: Array<{ locale: Locale; label: string; name: string; flag: string }> = [
  { locale: 'en', label: 'EN', name: 'English', flag: '🇬🇧' },
  { locale: 'ru', label: 'RU', name: 'Русский', flag: '🇷🇺' },
  { locale: 'ua', label: 'UA', name: 'Українська', flag: '🇺🇦' },
  { locale: 'ka', label: 'KA', name: 'ქართული', flag: '🇬🇪' },
];

export const weekdayLabels: Record<Locale, string[]> = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  ua: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  ka: ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'],
};

export const messages = {
  en: {
    metaTitle: 'Vanilla Sky tickets and flights in Georgia - GetFlights.ge',
    brandSub: 'Vanilla Sky tickets',
    aboutPrefix:
      "GetFlights.ge finds Vanilla Sky flights. Their own booking site makes them hard to find - we read the live schedule and show fares clearly. We don't sell tickets:",
    aboutBook: 'Book',
    aboutSuffix: 'hands you straight to Vanilla Sky, the flight operator, to pay.',
    dismiss: 'Dismiss',
    checkingFlights: 'Checking flights...',
    live: 'Live',
    updated: 'updated',
    refreshAvailability: 'Refresh availability',
    subbar: 'Only the days Vanilla Sky actually flies. Pick a route, pick a day, pay on Vanilla Sky.',
    routesAria: 'Routes flying now',
    route: 'Route',
    flyingNow: 'Flying now',
    next: 'next',
    noRoutes: 'No routes are flying right now.',
    noDatesAvailable: 'No dates available',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    pickAvailableDay: 'Pick an available day',
    passengers: {
      adult: 'Adults',
      child: 'Children',
      infant: 'Infants',
    },
    fewerPassengers: {
      adult: 'Fewer adults',
      child: 'Fewer children',
      infant: 'Fewer infants',
    },
    morePassengers: {
      adult: 'More adults',
      child: 'More children',
      infant: 'More infants',
    },
    noFlightsOnDay: 'No flights on this day - try another date.',
    couldNotReach: 'Could not reach Vanilla Sky. Try refreshing.',
    couldNotLoad: 'Could not load flights.',
    couldNotOpen: 'Could not open Vanilla Sky. Try again.',
    alertsHeading: 'Notify me about tickets',
    alertsIntro: 'Pick a date range and we will email you when tickets show up.',
    alertsEmailLabel: 'Email',
    alertsSubscribe: 'Notify me',
    alertsManage: 'Manage alerts',
    alertsDateFromLabel: 'From date',
    alertsDateToLabel: 'To date',
    alertsMonthShortcutLabel: 'Month shortcut',
    alertsMonthShortcut: 'This month',
    alertsAlreadyAvailable: 'Tickets are already available for this range.',
    alertsCheckEmail: 'Check your email to confirm this alert.',
    alertsValidationEmail: 'Enter a valid email address.',
    alertsValidationRange: 'Choose a valid date range.',
    alertsBackendError: 'Could not create the alert. Try again.',
    alertsManageHeading: 'Manage alerts',
    alertsManageIntro: 'Review your ticket alerts and unsubscribe per route.',
    alertsManageRequestIntro: 'Enter your email and we will send a manage link if alerts exist for it.',
    alertsManageLoading: 'Loading alerts...',
    alertsManageEmpty: 'No alerts found for this link.',
    alertsManageRequest: 'Email me a manage link',
    alertsManageLinkSent: 'If that email has alerts, we sent a manage link.',
    alertsManageUnsubscribe: 'Unsubscribe',
    alertsManageUnsubscribed: 'Unsubscribed',
    alertsManageLoadError: 'Could not load alerts. Try the link again.',
    alertsManageUnsubscribeError: 'Could not unsubscribe this alert. Try again.',
    alertsManageStatus: (status: string) => `Status: ${status}`,
    alertsManageMatchingDates: (count: number) => `${count} matching date${count === 1 ? '' : 's'}`,
    alertsManageLastAlert: (state: string) => `Last alert: ${state}`,
    checkingFare: 'Checking the live fare for this day...',
    noFlightsListed: 'No flights listed for this day.',
    pickHighlightedDay: 'Pick a highlighted day to see the flight.',
    bookOnVanillaSky: 'Book on Vanilla Sky',
    language: 'Language',
  },
  ru: {
    metaTitle: 'GetFlights.ge - Рейсы Vanilla Sky',
    brandSub: 'Билеты Vanilla Sky',
    aboutPrefix:
      'GetFlights.ge находит рейсы Vanilla Sky. На их сайте билеты бывает трудно найти - мы сканируем живое расписание и показываем тарифы понятнее. Мы не продаем билеты:',
    aboutBook: 'Кнопка «Забронировать»',
    aboutSuffix: 'переведет вас прямо на сайт Vanilla Sky, оператора рейса, для оплаты.',
    dismiss: 'Закрыть',
    checkingFlights: 'Проверяем рейсы...',
    live: 'Онлайн',
    updated: 'обновлено',
    refreshAvailability: 'Обновить наличие',
    subbar: 'Только дни, когда Vanilla Sky действительно летает. Выберите маршрут, день и оплатите на Vanilla Sky.',
    routesAria: 'Маршруты с рейсами сейчас',
    route: 'Маршрут',
    flyingNow: 'Летают сейчас',
    next: 'ближайший',
    noRoutes: 'Сейчас нет активных маршрутов.',
    noDatesAvailable: 'Нет доступных дат',
    previousMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    pickAvailableDay: 'Выберите доступный день',
    passengers: {
      adult: 'Взрослые',
      child: 'Дети',
      infant: 'Младенцы',
    },
    fewerPassengers: {
      adult: 'Меньше взрослых',
      child: 'Меньше детей',
      infant: 'Меньше младенцев',
    },
    morePassengers: {
      adult: 'Больше взрослых',
      child: 'Больше детей',
      infant: 'Больше младенцев',
    },
    noFlightsOnDay: 'В этот день рейсов нет - попробуйте другую дату.',
    couldNotReach: 'Не удалось связаться с Vanilla Sky. Попробуйте обновить.',
    couldNotLoad: 'Не удалось загрузить рейсы.',
    couldNotOpen: 'Не удалось открыть Vanilla Sky. Попробуйте еще раз.',
    alertsHeading: 'Сообщить о билетах',
    alertsIntro: 'Выберите диапазон дат, и мы напишем вам, когда появятся билеты.',
    alertsEmailLabel: 'Email',
    alertsSubscribe: 'Сообщить мне',
    alertsManage: 'Управлять уведомлениями',
    alertsDateFromLabel: 'Дата от',
    alertsDateToLabel: 'Дата до',
    alertsMonthShortcutLabel: 'Быстрый месяц',
    alertsMonthShortcut: 'Этот месяц',
    alertsAlreadyAvailable: 'Билеты на этот диапазон уже доступны.',
    alertsCheckEmail: 'Проверьте почту и подтвердите уведомление.',
    alertsValidationEmail: 'Введите корректный email.',
    alertsValidationRange: 'Выберите корректный диапазон дат.',
    alertsBackendError: 'Не удалось создать уведомление. Попробуйте еще раз.',
    alertsManageHeading: 'Управлять уведомлениями',
    alertsManageIntro: 'Проверьте свои уведомления о билетах и отключайте их по маршрутам.',
    alertsManageRequestIntro: 'Введите email, и мы отправим ссылку для управления, если для него есть уведомления.',
    alertsManageLoading: 'Загружаем уведомления...',
    alertsManageEmpty: 'Для этой ссылки уведомлений не найдено.',
    alertsManageRequest: 'Отправить ссылку для управления',
    alertsManageLinkSent: 'Если для этого email есть уведомления, мы отправили ссылку для управления.',
    alertsManageUnsubscribe: 'Отписаться',
    alertsManageUnsubscribed: 'Отписано',
    alertsManageLoadError: 'Не удалось загрузить уведомления. Попробуйте ссылку еще раз.',
    alertsManageUnsubscribeError: 'Не удалось отключить это уведомление. Попробуйте еще раз.',
    alertsManageStatus: (status: string) => `Статус: ${status}`,
    alertsManageMatchingDates: (count: number) => `${count} совпадающих дат`,
    alertsManageLastAlert: (state: string) => `Последнее уведомление: ${state}`,
    checkingFare: 'Проверяем актуальный тариф на этот день...',
    noFlightsListed: 'На этот день рейсы не указаны.',
    pickHighlightedDay: 'Выберите выделенный день, чтобы увидеть рейс.',
    bookOnVanillaSky: 'Забронировать на Vanilla Sky',
    language: 'Язык',
  },
  ua: {
    metaTitle: 'GetFlights.ge - Рейси Vanilla Sky',
    brandSub: 'Квитки Vanilla Sky',
    aboutPrefix:
      'GetFlights.ge знаходить рейси Vanilla Sky. На їхньому сайті квитки буває складно знайти - ми скануємо живий розклад і показуємо тарифи зрозуміліше. Ми не продаємо квитки:',
    aboutBook: 'Кнопка «Забронювати»',
    aboutSuffix: 'перенаправить вас прямо на сайт Vanilla Sky, оператора рейсу, для оплати.',
    dismiss: 'Закрити',
    checkingFlights: 'Перевіряємо рейси...',
    live: 'Онлайн',
    updated: 'оновлено',
    refreshAvailability: 'Оновити наявність',
    subbar: 'Тільки дні, коли Vanilla Sky справді літає. Виберіть маршрут, день і оплатіть на Vanilla Sky.',
    routesAria: 'Маршрути з рейсами зараз',
    route: 'Маршрут',
    flyingNow: 'Літають зараз',
    next: 'найближчий',
    noRoutes: 'Зараз немає активних маршрутів.',
    noDatesAvailable: 'Немає доступних дат',
    previousMonth: 'Попередній місяць',
    nextMonth: 'Наступний місяць',
    pickAvailableDay: 'Виберіть доступний день',
    passengers: {
      adult: 'Дорослі',
      child: 'Діти',
      infant: 'Немовлята',
    },
    fewerPassengers: {
      adult: 'Менше дорослих',
      child: 'Менше дітей',
      infant: 'Менше немовлят',
    },
    morePassengers: {
      adult: 'Більше дорослих',
      child: 'Більше дітей',
      infant: 'Більше немовлят',
    },
    noFlightsOnDay: 'У цей день рейсів немає - спробуйте іншу дату.',
    couldNotReach: 'Не вдалося звʼязатися з Vanilla Sky. Спробуйте оновити.',
    couldNotLoad: 'Не вдалося завантажити рейси.',
    couldNotOpen: 'Не вдалося відкрити Vanilla Sky. Спробуйте ще раз.',
    alertsHeading: 'Повідомити про квитки',
    alertsIntro: 'Виберіть діапазон дат, і ми напишемо вам, коли зʼявляться квитки.',
    alertsEmailLabel: 'Email',
    alertsSubscribe: 'Повідомити мене',
    alertsManage: 'Керувати сповіщеннями',
    alertsDateFromLabel: 'Дата від',
    alertsDateToLabel: 'Дата до',
    alertsMonthShortcutLabel: 'Швидкий місяць',
    alertsMonthShortcut: 'Цей місяць',
    alertsAlreadyAvailable: 'Квитки на цей діапазон уже доступні.',
    alertsCheckEmail: 'Перевірте пошту й підтвердьте це сповіщення.',
    alertsValidationEmail: 'Введіть коректний email.',
    alertsValidationRange: 'Виберіть коректний діапазон дат.',
    alertsBackendError: 'Не вдалося створити сповіщення. Спробуйте ще раз.',
    alertsManageHeading: 'Керувати сповіщеннями',
    alertsManageIntro: 'Переглядайте сповіщення про квитки та вимикайте їх окремо за маршрутами.',
    alertsManageRequestIntro: 'Введіть email, і ми надішлемо посилання для керування, якщо для нього є сповіщення.',
    alertsManageLoading: 'Завантажуємо сповіщення...',
    alertsManageEmpty: 'Для цього посилання сповіщень не знайдено.',
    alertsManageRequest: 'Надіслати посилання для керування',
    alertsManageLinkSent: 'Якщо для цього email є сповіщення, ми надіслали посилання для керування.',
    alertsManageUnsubscribe: 'Відписатися',
    alertsManageUnsubscribed: 'Відписано',
    alertsManageLoadError: 'Не вдалося завантажити сповіщення. Спробуйте посилання ще раз.',
    alertsManageUnsubscribeError: 'Не вдалося вимкнути це сповіщення. Спробуйте ще раз.',
    alertsManageStatus: (status: string) => `Статус: ${status}`,
    alertsManageMatchingDates: (count: number) => `${count} відповідних дат`,
    alertsManageLastAlert: (state: string) => `Останнє сповіщення: ${state}`,
    checkingFare: 'Перевіряємо актуальний тариф на цей день...',
    noFlightsListed: 'На цей день рейси не вказані.',
    pickHighlightedDay: 'Виберіть виділений день, щоб побачити рейс.',
    bookOnVanillaSky: 'Забронювати на Vanilla Sky',
    language: 'Мова',
  },
  ka: {
    metaTitle: 'GetFlights.ge - Vanilla Sky-ის ფრენები',
    brandSub: 'Vanilla Sky-ის ბილეთები',
    aboutPrefix:
      'GetFlights.ge პოულობს Vanilla Sky-ის ფრენებს. მათ დაჯავშნის საიტზე ბილეთების პოვნა რთულია - ჩვენ ვამოწმებთ ცოცხალ განრიგს და ფასებს გასაგებად ვაჩვენებთ. ბილეთებს არ ვყიდით:',
    aboutBook: 'ღილაკი „დაჯავშნა“',
    aboutSuffix: 'გადაგიყვანთ პირდაპირ Vanilla Sky-ის, ფრენის ოპერატორის, საიტზე გადახდისთვის.',
    dismiss: 'დახურვა',
    checkingFlights: 'ფრენებს ვამოწმებთ...',
    live: 'ცოცხალი',
    updated: 'განახლდა',
    refreshAvailability: 'ხელმისაწვდომობის განახლება',
    subbar:
      'მხოლოდ ის დღეები, როცა Vanilla Sky ნამდვილად დაფრინავს. აირჩიეთ მარშრუტი, დღე და გადაიხადეთ Vanilla Sky-ზე.',
    routesAria: 'მარშრუტები, რომლებზეც ახლა ფრენებია',
    route: 'მარშრუტი',
    flyingNow: 'ფრენები ახლა',
    next: 'შემდეგი',
    noRoutes: 'ამჟამად აქტიური მარშრუტები არ არის.',
    noDatesAvailable: 'ხელმისაწვდომი თარიღები არ არის',
    previousMonth: 'წინა თვე',
    nextMonth: 'შემდეგი თვე',
    pickAvailableDay: 'აირჩიეთ ხელმისაწვდომი დღე',
    passengers: {
      adult: 'ზრდასრულები',
      child: 'ბავშვები',
      infant: 'ჩვილები',
    },
    fewerPassengers: {
      adult: 'ნაკლები ზრდასრული',
      child: 'ნაკლები ბავშვი',
      infant: 'ნაკლები ჩვილი',
    },
    morePassengers: {
      adult: 'მეტი ზრდასრული',
      child: 'მეტი ბავშვი',
      infant: 'მეტი ჩვილი',
    },
    noFlightsOnDay: 'ამ დღეს ფრენები არ არის - სცადეთ სხვა თარიღი.',
    couldNotReach: 'Vanilla Sky-თან დაკავშირება ვერ მოხერხდა. სცადეთ განახლება.',
    couldNotLoad: 'ფრენების ჩატვირთვა ვერ მოხერხდა.',
    couldNotOpen: 'Vanilla Sky-ის გახსნა ვერ მოხერხდა. სცადეთ ხელახლა.',
    alertsHeading: 'ბილეთებზე შემატყობინე',
    alertsIntro: 'აირჩიეთ თარიღების დიაპაზონი და ბილეთების გამოჩენისას ელფოსტაზე მოგწერთ.',
    alertsEmailLabel: 'ელფოსტა',
    alertsSubscribe: 'შემატყობინე',
    alertsManage: 'შეტყობინებების მართვა',
    alertsDateFromLabel: 'თარიღი საიდან',
    alertsDateToLabel: 'თარიღი სადამდე',
    alertsMonthShortcutLabel: 'თვიური მალსახმობი',
    alertsMonthShortcut: 'ეს თვე',
    alertsAlreadyAvailable: 'ამ დიაპაზონში ბილეთები უკვე ხელმისაწვდომია.',
    alertsCheckEmail: 'შეტყობინების დასადასტურებლად ელფოსტა შეამოწმეთ.',
    alertsValidationEmail: 'შეიყვანეთ სწორი ელფოსტა.',
    alertsValidationRange: 'აირჩიეთ სწორი თარიღების დიაპაზონი.',
    alertsBackendError: 'შეტყობინების შექმნა ვერ მოხერხდა. სცადეთ ხელახლა.',
    alertsManageHeading: 'შეტყობინებების მართვა',
    alertsManageIntro: 'ნახეთ თქვენი ბილეთების შეტყობინებები და თითოეული მარშრუტი ცალ-ცალკე გააუქმეთ.',
    alertsManageRequestIntro: 'შეიყვანეთ ელფოსტა და თუ ამ მისამართზე შეტყობინებები არსებობს, მართვის ბმულს გამოგიგზავნით.',
    alertsManageLoading: 'შეტყობინებებს ვტვირთავთ...',
    alertsManageEmpty: 'ამ ბმულისთვის შეტყობინებები ვერ მოიძებნა.',
    alertsManageRequest: 'მართვის ბმული ელფოსტაზე გამომიგზავნე',
    alertsManageLinkSent: 'თუ ამ ელფოსტაზე შეტყობინებები არსებობს, მართვის ბმული გამოგიგზავნეთ.',
    alertsManageUnsubscribe: 'გაუქმება',
    alertsManageUnsubscribed: 'გაუქმებულია',
    alertsManageLoadError: 'შეტყობინებების ჩატვირთვა ვერ მოხერხდა. ბმული ხელახლა სცადეთ.',
    alertsManageUnsubscribeError: 'ამ შეტყობინების გაუქმება ვერ მოხერხდა. სცადეთ ხელახლა.',
    alertsManageStatus: (status: string) => `სტატუსი: ${status}`,
    alertsManageMatchingDates: (count: number) => `${count} შესაბამისი თარიღი`,
    alertsManageLastAlert: (state: string) => `ბოლო შეტყობინება: ${state}`,
    checkingFare: 'ამ დღის მიმდინარე ტარიფს ვამოწმებთ...',
    noFlightsListed: 'ამ დღისთვის ფრენები მითითებული არ არის.',
    pickHighlightedDay: 'ფრენის სანახავად აირჩიეთ მონიშნული დღე.',
    bookOnVanillaSky: 'დაჯავშნა Vanilla Sky-ზე',
    language: 'ენა',
  },
} satisfies Record<Locale, Record<string, unknown>>;

const cityNames: Record<Locale, Record<string, string>> = {
  en: {
    '1': 'Tbilisi',
    '2': 'Ambrolauri',
    '4': 'Batumi',
    '5': 'Kutaisi',
    '6': 'Mestia',
    '7': 'Tbilisi (Natakhtari airport)',
  },
  ru: {
    '1': 'Тбилиси',
    '2': 'Амбролаури',
    '4': 'Батуми',
    '5': 'Кутаиси',
    '6': 'Местиа',
    '7': 'Тбилиси (Аэропорт Натахтари)',
  },
  ua: {
    '1': 'Тбілісі',
    '2': 'Амбролаурі',
    '4': 'Батумі',
    '5': 'Кутаїсі',
    '6': 'Местія',
    '7': 'Тбілісі (Аеропорт Натахтарі)',
  },
  ka: {
    '1': 'თბილისი',
    '2': 'ამბროლაური',
    '4': 'ბათუმი',
    '5': 'ქუთაისი',
    '6': 'მესტია',
    '7': 'თბილისი (ნატახტრის აეროპორტი)',
  },
};

const localeAliases: Record<string, Locale> = {
  en: 'en',
  ru: 'ru',
  uk: 'ua',
  ua: 'ua',
  ka: 'ka',
  ge: 'ka',
};

export function toIntlLocale(locale: Locale) {
  return locale === 'ua' ? 'uk' : locale;
}

export function resolveLocale({
  pathname = '/',
  search,
  storedLocale,
  navigatorLanguages,
}: {
  pathname?: string;
  search: string;
  storedLocale: string | null;
  navigatorLanguages: readonly string[];
}): Locale {
  const pathLocale = normalizeLocale(pathname.split('/').find(Boolean));
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return (
    pathLocale ??
    normalizeLocale(params.get('lang')) ??
    normalizeLocale(storedLocale) ??
    navigatorLanguages.map(normalizeLocale).find((locale): locale is Locale => Boolean(locale)) ??
    'en'
  );
}

export function readInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }

  return resolveLocale({
    pathname: window.location.pathname,
    search: window.location.search,
    storedLocale: readStoredLocale(),
    navigatorLanguages: Array.from(navigator.languages?.length ? navigator.languages : [navigator.language]),
  });
}

export function readStoredLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;

  const normalized = value.toLowerCase().replace('_', '-');
  const primary = normalized.split('-')[0];
  return localeAliases[normalized] ?? localeAliases[primary] ?? null;
}

export function getOfficialFormLocale(locale: Locale): OfficialFormLocale {
  return locale === 'ru' ? 'ru' : 'en';
}

export function getCityName(cityId: string, locale: Locale, fallback = '') {
  return cityNames[locale][cityId] ?? fallback;
}

export function formatDateCount(count: number, locale: Locale) {
  if (locale === 'en') {
    return `${count} date${count === 1 ? '' : 's'}`;
  }
  if (locale === 'ka') {
    return `${count} თარიღი`;
  }

  const forms =
    locale === 'ru'
      ? { one: 'дата', few: 'даты', many: 'дат', other: 'дат' }
      : { one: 'дата', few: 'дати', many: 'дат', other: 'дат' };
  const plural = new Intl.PluralRules(toIntlLocale(locale)).select(count) as keyof typeof forms;
  return `${count} ${forms[plural]}`;
}

export function formatShortDate(iso: string, locale: Locale) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(toIntlLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}

export function formatSelectedDate(iso: string, locale: Locale) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function formatRelativeAge(iso: string, locale: Locale, now = new Date()) {
  const formatter = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: 'auto' });
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);

  if (absoluteSeconds < 60) {
    return formatter.format(0, 'second');
  }
  if (absoluteSeconds < 60 * 60) {
    return formatter.format(Math.round(diffSeconds / 60), 'minute');
  }
  if (absoluteSeconds < 24 * 60 * 60) {
    return formatter.format(Math.round(diffSeconds / (60 * 60)), 'hour');
  }
  if (absoluteSeconds < 7 * 24 * 60 * 60) {
    return formatter.format(Math.round(diffSeconds / (24 * 60 * 60)), 'day');
  }

  return formatter.format(Math.round(diffSeconds / (7 * 24 * 60 * 60)), 'week');
}

export function withLocaleInUrl(href: string, locale: Locale) {
  const url = new URL(href, 'https://local.invalid');
  url.searchParams.delete('lang');
  url.pathname = withLocalePath(url.pathname, locale);
  return `${url.pathname}${url.search}${url.hash}`;
}

function withLocalePath(pathname: string, locale: Locale) {
  const parts = pathname.split('/');
  const firstSegment = parts.find(Boolean);
  const hasLocalePrefix = Boolean(normalizeLocale(firstSegment));
  const remainingParts = hasLocalePrefix ? parts.slice(2) : parts.slice(1);
  const remainingPath = remainingParts.filter(Boolean).join('/');
  const trailingSlash = pathname.endsWith('/');

  return remainingPath ? `/${locale}/${remainingPath}${trailingSlash ? '/' : ''}` : `/${locale}/`;
}
