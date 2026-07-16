import type { Locale } from './i18n';

const SITE_ORIGIN = 'https://getflights.ge';

type RouteDefinition = {
  slug: string;
  fromId: string;
  toId: string;
  publicFrom: Record<Locale, string>;
  publicTo: Record<Locale, string>;
  officialFrom: Record<Locale, string>;
  officialTo: Record<Locale, string>;
  airportNote: Record<Locale, string>;
};

type HubDefinition = {
  slug: string;
  topic: 'georgia' | 'vanilla-sky' | 'natakhtari';
};

export type RouteSeoFaq = {
  question: string;
  answer: string;
};

export type RouteSeoLink = {
  label: string;
  href: `/${Locale}/${string}/`;
};

type BaseRouteSeoPage = {
  locale: Locale;
  slug: string;
  path: `/${Locale}/${string}/`;
  title: string;
  description: string;
  h1: string;
  intro: string;
  cta: string;
  faqs: RouteSeoFaq[];
  relatedLinks: RouteSeoLink[];
};

export type RouteSeoPage =
  | (BaseRouteSeoPage & {
      kind: 'route';
      route: {
        fromId: string;
        toId: string;
        publicFrom: string;
        publicTo: string;
        officialFrom: string;
        officialTo: string;
        airportNote: string;
      };
    })
  | (BaseRouteSeoPage & {
      kind: 'hub';
      topic: HubDefinition['topic'];
    });

const locales: Locale[] = ['en', 'ru', 'ua', 'ka'];

const routes: RouteDefinition[] = [
  route('flights/tbilisi-batumi', '7', '4', city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი'), city('Batumi', 'Батуми', 'Батумі', 'ბათუმი')),
  route('flights/batumi-tbilisi', '4', '7', city('Batumi', 'Батуми', 'Батумі', 'ბათუმი'), city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი')),
  route('flights/tbilisi-mestia', '7', '6', city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი'), city('Mestia', 'Местиа', 'Местія', 'მესტია')),
  route('flights/mestia-tbilisi', '6', '7', city('Mestia', 'Местиа', 'Местія', 'მესტია'), city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი')),
  route('flights/tbilisi-ambrolauri', '7', '2', city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი'), city('Ambrolauri', 'Амбролаури', 'Амбролаурі', 'ამბროლაური')),
  route('flights/ambrolauri-tbilisi', '2', '7', city('Ambrolauri', 'Амбролаури', 'Амбролаурі', 'ამბროლაური'), city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი')),
  route('flights/kutaisi-mestia', '5', '6', city('Kutaisi', 'Кутаиси', 'Кутаїсі', 'ქუთაისი'), city('Mestia', 'Местиа', 'Местія', 'მესტია')),
  route('flights/mestia-kutaisi', '6', '5', city('Mestia', 'Местиа', 'Местія', 'მესტია'), city('Kutaisi', 'Кутаиси', 'Кутаїсі', 'ქუთაისი')),
];

const hubs: HubDefinition[] = [
  { slug: 'flights', topic: 'georgia' },
  { slug: 'flights/vanilla-sky', topic: 'vanilla-sky' },
  { slug: 'flights/natakhtari-airport', topic: 'natakhtari' },
];

export function routeSeoPagesForLocale(locale: Locale) {
  return routeSeoPages.filter((page) => page.locale === locale);
}

export function getRouteSeoPageByPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return routeSeoPages.find((page) => page.path === normalized) ?? null;
}

export function routeSeoPageUrl(page: RouteSeoPage) {
  return `${SITE_ORIGIN}${page.path}`;
}

export function routeSeoPageUrlForLocale(page: RouteSeoPage, locale: Locale) {
  return `${SITE_ORIGIN}/${locale}/${page.slug}/`;
}

function buildRoutePage(locale: Locale, routeDefinition: RouteDefinition): RouteSeoPage {
  const from = routeDefinition.publicFrom[locale];
  const to = routeDefinition.publicTo[locale];
  const officialFrom = routeDefinition.officialFrom[locale];
  const officialTo = routeDefinition.officialTo[locale];
  const airportNote = routeDefinition.airportNote[locale];

  return {
    locale,
    kind: 'route',
    slug: routeDefinition.slug,
    path: `/${locale}/${routeDefinition.slug}/`,
    title: routeTitle(locale, from, to),
    description: routeDescription(locale, from, to, airportNote),
    h1: routeH1(locale, from, to),
    intro: routeIntro(locale, from, to, airportNote),
    cta: routeCta(locale),
    faqs: routeFaqs(locale, from, to, officialFrom, officialTo),
    relatedLinks: routeRelatedLinks(locale, routeDefinition),
    route: {
      fromId: routeDefinition.fromId,
      toId: routeDefinition.toId,
      publicFrom: from,
      publicTo: to,
      officialFrom,
      officialTo,
      airportNote,
    },
  };
}

function buildHubPage(locale: Locale, hub: HubDefinition): RouteSeoPage {
  const copy = hubCopy[hub.topic][locale];
  return {
    locale,
    kind: 'hub',
    topic: hub.topic,
    slug: hub.slug,
    path: `/${locale}/${hub.slug}/`,
    title: copy.title,
    description: copy.description,
    h1: copy.h1,
    intro: copy.intro,
    cta: copy.cta,
    faqs: copy.faqs,
    relatedLinks: hubRelatedLinks(locale, hub.topic),
  };
}

function route(slug: string, fromId: string, toId: string, publicFrom: Record<Locale, string>, publicTo: Record<Locale, string>): RouteDefinition {
  return {
    slug,
    fromId,
    toId,
    publicFrom,
    publicTo,
    officialFrom: officialAirportName(fromId, publicFrom),
    officialTo: officialAirportName(toId, publicTo),
    airportNote: airportNoteForRoute(fromId, toId),
  };
}

function city(en: string, ru: string, ua: string, ka: string): Record<Locale, string> {
  return { en, ru, ua, ka };
}

function officialAirportName(cityId: string, fallback: Record<Locale, string>) {
  if (cityId !== '7') return fallback;
  return {
    en: 'Tbilisi (Natakhtari airport)',
    ru: 'Тбилиси (аэропорт Натахтари)',
    ua: 'Тбілісі (аеропорт Натахтарі)',
    ka: 'თბილისი (ნატახტრის აეროპორტი)',
  };
}

function airportNoteForRoute(fromId: string, toId: string): Record<Locale, string> {
  if (fromId !== '7' && toId !== '7') {
    return {
      en: 'This route does not use Natakhtari airport.',
      ru: 'Этот маршрут не использует аэропорт Натахтари.',
      ua: 'Цей маршрут не використовує аеропорт Натахтарі.',
      ka: 'ეს მარშრუტი ნატახტრის აეროპორტს არ იყენებს.',
    };
  }

  return {
    en: 'Vanilla Sky uses Natakhtari airport for Tbilisi-area domestic flights.',
    ru: 'Vanilla Sky использует аэропорт Натахтари для внутренних рейсов из района Тбилиси.',
    ua: 'Vanilla Sky використовує аеропорт Натахтарі для внутрішніх рейсів з району Тбілісі.',
    ka: 'Vanilla Sky თბილისის შიდა ფრენებისთვის ნატახტრის აეროპორტს იყენებს.',
  };
}

function routeTitle(locale: Locale, from: string, to: string) {
  if (locale === 'ru') return `Купить авиабилеты ${from} - ${to} | GetFlights.ge`;
  if (locale === 'ua') return `Купити авіаквитки ${from} - ${to} | GetFlights.ge`;
  if (locale === 'ka') return `${from} - ${to} ავიაბილეთები | GetFlights.ge`;
  return `Buy ${from} to ${to} flight tickets | GetFlights.ge`;
}

function routeDescription(locale: Locale, from: string, to: string, airportNote: string) {
  if (locale === 'ru') {
    return `Найдите доступные билеты Vanilla Sky ${from} - ${to}, проверьте ближайшие даты рейсов и перейдите на официальный сайт для оплаты. ${airportNote}`;
  }
  if (locale === 'ua') {
    return `Знайдіть доступні квитки Vanilla Sky ${from} - ${to}, перевірте найближчі дати рейсів і перейдіть на офіційний сайт для оплати. ${airportNote}`;
  }
  if (locale === 'ka') {
    return `იპოვეთ Vanilla Sky-ის ხელმისაწვდომი ბილეთები ${from} - ${to}, შეამოწმეთ უახლოესი ფრენები და გადადით ოფიციალურ საიტზე გადახდისთვის. ${airportNote}`;
  }
  return `Find available Vanilla Sky ${from} to ${to} tickets, check the next flight dates, and continue to the official site to pay. ${airportNote}`;
}

function routeH1(locale: Locale, from: string, to: string) {
  if (locale === 'ru') return `Купить авиабилеты ${from} - ${to}`;
  if (locale === 'ua') return `Купити авіаквитки ${from} - ${to}`;
  if (locale === 'ka') return `${from} - ${to} ავიაბილეთები`;
  return `Buy ${from} to ${to} flight tickets`;
}

function routeIntro(locale: Locale, from: string, to: string, airportNote: string) {
  if (locale === 'ru') {
    return `Проверьте живую доступность билетов Vanilla Sky на маршруте ${from} - ${to}. GetFlights.ge показывает дни, когда рейс реально выполняется, а оплата завершается на официальном сайте Vanilla Sky. ${airportNote}`;
  }
  if (locale === 'ua') {
    return `Перевірте живу наявність квитків Vanilla Sky на маршруті ${from} - ${to}. GetFlights.ge показує дні, коли рейс справді виконується, а оплата завершується на офіційному сайті Vanilla Sky. ${airportNote}`;
  }
  if (locale === 'ka') {
    return `შეამოწმეთ Vanilla Sky-ის ბილეთების ცოცხალი ხელმისაწვდომობა მარშრუტზე ${from} - ${to}. GetFlights.ge აჩვენებს რეალურ ფრენის დღეებს, გადახდა კი Vanilla Sky-ის ოფიციალურ საიტზე სრულდება. ${airportNote}`;
  }
  return `Check live Vanilla Sky ticket availability for ${from} to ${to}. GetFlights.ge shows the days this domestic flight is actually available, then sends you to the official Vanilla Sky website to complete payment. ${airportNote}`;
}

function routeCta(locale: Locale) {
  if (locale === 'ru') return 'Проверить доступные даты и перейти к официальному бронированию';
  if (locale === 'ua') return 'Перевірити доступні дати і перейти до офіційного бронювання';
  if (locale === 'ka') return 'შეამოწმეთ ხელმისაწვდომი თარიღები და გადადით ოფიციალურ დაჯავშნაზე';
  return 'Check available dates and continue to official booking';
}

function routeFaqs(locale: Locale, from: string, to: string, officialFrom: string, officialTo: string): RouteSeoFaq[] {
  if (locale === 'ru') {
    return [
      {
        question: `Можно ли купить билет ${from} - ${to} здесь?`,
        answer: 'Здесь можно найти доступные даты и тарифы. Оплата и выпуск билета выполняются на официальном сайте Vanilla Sky.',
      },
      {
        question: `Какой аэропорт используется для рейса ${from} - ${to}?`,
        answer: `Официальный маршрут в системе бронирования: ${officialFrom} - ${officialTo}.`,
      },
    ];
  }
  if (locale === 'ua') {
    return [
      {
        question: `Чи можна купити квиток ${from} - ${to} тут?`,
        answer: 'Тут можна знайти доступні дати і тарифи. Оплата та випуск квитка виконуються на офіційному сайті Vanilla Sky.',
      },
      {
        question: `Який аеропорт використовується для рейсу ${from} - ${to}?`,
        answer: `Офіційний маршрут у системі бронювання: ${officialFrom} - ${officialTo}.`,
      },
    ];
  }
  if (locale === 'ka') {
    return [
      {
        question: `შეიძლება აქ ${from} - ${to} ბილეთის ყიდვა?`,
        answer: 'აქ შეგიძლიათ ნახოთ ხელმისაწვდომი თარიღები და ტარიფები. გადახდა და ბილეთის გაფორმება Vanilla Sky-ის ოფიციალურ საიტზე ხდება.',
      },
      {
        question: `რომელი აეროპორტი გამოიყენება ${from} - ${to} რეისისთვის?`,
        answer: `ოფიციალური მარშრუტი დაჯავშნის სისტემაშია: ${officialFrom} - ${officialTo}.`,
      },
    ];
  }
  return [
    {
      question: `Can I buy a ${from} to ${to} ticket here?`,
      answer: 'You can find available dates and fares here. Payment and ticket issuance happen on the official Vanilla Sky website.',
    },
    {
      question: `Which airport is used for the ${from} to ${to} flight?`,
      answer: `The official booking route is ${officialFrom} to ${officialTo}.`,
    },
  ];
}

function routeRelatedLinks(locale: Locale, routeDefinition: RouteDefinition): RouteSeoLink[] {
  const from = routeDefinition.publicFrom[locale];
  const to = routeDefinition.publicTo[locale];
  const reverseRoute = routes.find((routeDefinitionCandidate) =>
    routeDefinitionCandidate.fromId === routeDefinition.toId && routeDefinitionCandidate.toId === routeDefinition.fromId
  );
  const labels = relatedLabels[locale];
  const links: RouteSeoLink[] = [
    seoLink(locale, 'flights', labels.domesticFlights),
    seoLink(locale, 'flights/vanilla-sky', labels.vanillaSky),
  ];

  if (routeDefinition.fromId === '7' || routeDefinition.toId === '7') {
    links.push(seoLink(locale, 'flights/natakhtari-airport', labels.natakhtari));
  }

  if (reverseRoute) {
    links.push(seoLink(locale, reverseRoute.slug, reverseRouteLabel(locale, to, from)));
  }

  links.push(seoLink(locale, 'blog/vanilla-sky-baggage-weather-cancellations', labels.baggageWeather));

  return links;
}

function hubRelatedLinks(locale: Locale, topic: HubDefinition['topic']): RouteSeoLink[] {
  const labels = relatedLabels[locale];
  if (topic === 'natakhtari') {
    return [
      seoLink(locale, 'flights/tbilisi-mestia', routeLabel(locale, 'Tbilisi', 'Mestia')),
      seoLink(locale, 'flights/tbilisi-batumi', routeLabel(locale, 'Tbilisi', 'Batumi')),
      seoLink(locale, 'flights/tbilisi-ambrolauri', routeLabel(locale, 'Tbilisi', 'Ambrolauri')),
      seoLink(locale, 'blog/natakhtari-airport-guide', labels.natakhtariGuide),
    ];
  }
  if (topic === 'vanilla-sky') {
    return [
      seoLink(locale, 'flights/tbilisi-mestia', routeLabel(locale, 'Tbilisi', 'Mestia')),
      seoLink(locale, 'flights/kutaisi-mestia', routeLabel(locale, 'Kutaisi', 'Mestia')),
      seoLink(locale, 'blog/how-to-buy-vanilla-sky-tickets', labels.howToBuy),
      seoLink(locale, 'blog/vanilla-sky-baggage-weather-cancellations', labels.baggageWeather),
    ];
  }
  return [
    seoLink(locale, 'flights/vanilla-sky', labels.vanillaSky),
    seoLink(locale, 'flights/tbilisi-batumi', routeLabel(locale, 'Tbilisi', 'Batumi')),
    seoLink(locale, 'flights/tbilisi-mestia', routeLabel(locale, 'Tbilisi', 'Mestia')),
    seoLink(locale, 'blog/how-to-buy-vanilla-sky-tickets', labels.howToBuy),
  ];
}

function seoLink(locale: Locale, slug: string, label: string): RouteSeoLink {
  return {
    label,
    href: `/${locale}/${slug}/`,
  };
}

function routeLabel(locale: Locale, from: string, to: string) {
  if (locale === 'ru') return `Авиабилеты ${translateRouteCity(locale, from)} - ${translateRouteCity(locale, to)}`;
  if (locale === 'ua') return `Авіаквитки ${translateRouteCity(locale, from)} - ${translateRouteCity(locale, to)}`;
  if (locale === 'ka') return `${translateRouteCity(locale, from)} - ${translateRouteCity(locale, to)} ავიაბილეთები`;
  return `${from} to ${to} flight tickets`;
}

function reverseRouteLabel(locale: Locale, from: string, to: string) {
  if (locale === 'ru') return `Обратный маршрут: ${from} - ${to}`;
  if (locale === 'ua') return `Зворотний маршрут: ${from} - ${to}`;
  if (locale === 'ka') return `უკანა მარშრუტი: ${from} - ${to}`;
  return `Reverse route: ${from} to ${to}`;
}

function translateRouteCity(locale: Locale, cityName: string) {
  const translations: Record<string, Record<Locale, string>> = {
    Tbilisi: city('Tbilisi', 'Тбилиси', 'Тбілісі', 'თბილისი'),
    Batumi: city('Batumi', 'Батуми', 'Батумі', 'ბათუმი'),
    Mestia: city('Mestia', 'Местиа', 'Местія', 'მესტია'),
    Ambrolauri: city('Ambrolauri', 'Амбролаури', 'Амбролаурі', 'ამბროლაური'),
    Kutaisi: city('Kutaisi', 'Кутаиси', 'Кутаїсі', 'ქუთაისი'),
  };
  return translations[cityName]?.[locale] ?? cityName;
}

const relatedLabels: Record<Locale, Record<string, string>> = {
  en: {
    domesticFlights: 'Domestic flight tickets in Georgia',
    vanillaSky: 'Vanilla Sky tickets and schedule',
    natakhtari: 'Natakhtari airport flights',
    howToBuy: 'How to buy Vanilla Sky tickets online',
    baggageWeather: 'Vanilla Sky baggage and weather cancellation guide',
    natakhtariGuide: 'Natakhtari airport guide',
  },
  ru: {
    domesticFlights: 'Авиабилеты на внутренние рейсы по Грузии',
    vanillaSky: 'Билеты и расписание Vanilla Sky',
    natakhtari: 'Рейсы из аэропорта Натахтари',
    howToBuy: 'Как купить билеты Vanilla Sky онлайн',
    baggageWeather: 'Багаж Vanilla Sky и отмены из-за погоды',
    natakhtariGuide: 'Гид по аэропорту Натахтари',
  },
  ua: {
    domesticFlights: 'Авіаквитки на внутрішні рейси Грузією',
    vanillaSky: 'Квитки і розклад Vanilla Sky',
    natakhtari: 'Рейси з аеропорту Натахтарі',
    howToBuy: 'Як купити квитки Vanilla Sky онлайн',
    baggageWeather: 'Багаж Vanilla Sky і скасування через погоду',
    natakhtariGuide: 'Гайд по аеропорту Натахтарі',
  },
  ka: {
    domesticFlights: 'შიდა ფრენების ბილეთები საქართველოში',
    vanillaSky: 'Vanilla Sky ბილეთები და განრიგი',
    natakhtari: 'ნატახტრის აეროპორტის ფრენები',
    howToBuy: 'როგორ ვიყიდოთ Vanilla Sky-ის ბილეთები ონლაინ',
    baggageWeather: 'Vanilla Sky-ის ბარგი და ამინდით გაუქმება',
    natakhtariGuide: 'ნატახტრის აეროპორტის გზამკვლევი',
  },
};

const hubCopy: Record<HubDefinition['topic'], Record<Locale, Omit<BaseRouteSeoPage, 'locale' | 'slug' | 'path' | 'relatedLinks'> & { faqs: RouteSeoFaq[] }>> = {
  georgia: {
    en: hub(
      'Domestic flight tickets in Georgia | GetFlights.ge',
      'Find Vanilla Sky domestic flight tickets across Georgia, compare live route dates, and continue to the official booking site to pay.',
      'Buy domestic flight tickets in Georgia',
      'Use GetFlights.ge to find domestic Vanilla Sky flights between Tbilisi, Batumi, Mestia, Ambrolauri, and Kutaisi. We show live flight days and send you to the official operator website for payment.',
      'Check Georgian domestic flight dates',
      [
        {
          question: 'Which cities in Georgia have domestic flights?',
          answer: 'Vanilla Sky connects Tbilisi (via Natakhtari airport), Batumi, Mestia, Ambrolauri, and Kutaisi. The most popular routes are Tbilisi to Mestia, Tbilisi to Batumi, and Kutaisi to Mestia.',
        },
        {
          question: 'Can I pay for domestic flight tickets on GetFlights.ge?',
          answer: 'No. GetFlights.ge shows live availability first, then sends payment and ticket issuance to the official Vanilla Sky website, so you always book directly with the airline.',
        },
      ],
    ),
    ru: hub(
      'Авиабилеты на внутренние рейсы по Грузии | GetFlights.ge',
      'Находите билеты Vanilla Sky на внутренние рейсы по Грузии, сравнивайте живые даты маршрутов и переходите на официальный сайт для оплаты.',
      'Купить авиабилеты на внутренние рейсы по Грузии',
      'GetFlights.ge помогает найти внутренние рейсы Vanilla Sky между Тбилиси, Батуми, Местией, Амбролаури и Кутаиси. Мы показываем живые даты рейсов и переводим на официальный сайт оператора для оплаты.',
      'Проверить даты внутренних рейсов',
      [
        {
          question: 'Между какими городами Грузии есть внутренние рейсы?',
          answer: 'Vanilla Sky соединяет Тбилиси (через аэропорт Натахтари), Батуми, Местию, Амбролаури и Кутаиси. Самые популярные маршруты — Тбилиси - Местиа, Тбилиси - Батуми и Кутаиси - Местиа.',
        },
        {
          question: 'Можно ли оплатить билеты на внутренние рейсы на GetFlights.ge?',
          answer: 'Нет. GetFlights.ge сначала показывает живую доступность, а оплата и оформление билета выполняются на официальном сайте Vanilla Sky — вы всегда бронируете напрямую у авиакомпании.',
        },
      ],
    ),
    ua: hub(
      'Авіаквитки на внутрішні рейси Грузією | GetFlights.ge',
      'Знаходьте квитки Vanilla Sky на внутрішні рейси Грузією, порівнюйте живі дати маршрутів і переходьте на офіційний сайт для оплати.',
      'Купити авіаквитки на внутрішні рейси Грузією',
      'GetFlights.ge допомагає знайти внутрішні рейси Vanilla Sky між Тбілісі, Батумі, Местією, Амбролаурі та Кутаїсі. Ми показуємо живі дати рейсів і переводимо на офіційний сайт оператора для оплати.',
      'Перевірити дати внутрішніх рейсів',
      [
        {
          question: 'Між якими містами Грузії є внутрішні рейси?',
          answer: 'Vanilla Sky сполучає Тбілісі (через аеропорт Натахтарі), Батумі, Местію, Амбролаурі та Кутаїсі. Найпопулярніші маршрути — Тбілісі - Местія, Тбілісі - Батумі та Кутаїсі - Местія.',
        },
        {
          question: 'Чи можна оплатити квитки на внутрішні рейси на GetFlights.ge?',
          answer: 'Ні. GetFlights.ge спочатку показує живу наявність, а оплата та оформлення квитка виконуються на офіційному сайті Vanilla Sky — ви завжди бронюєте напряму в авіакомпанії.',
        },
      ],
    ),
    ka: hub(
      'შიდა ფრენების ბილეთები საქართველოში | GetFlights.ge',
      'იპოვეთ Vanilla Sky-ის შიდა ფრენების ბილეთები საქართველოში, შეადარეთ ცოცხალი თარიღები და გადადით ოფიციალურ საიტზე გადახდისთვის.',
      'შიდა ფრენების ბილეთები საქართველოში',
      'GetFlights.ge გეხმარებათ იპოვოთ Vanilla Sky-ის შიდა ფრენები თბილისს, ბათუმს, მესტიას, ამბროლაურსა და ქუთაისს შორის. ჩვენ ვაჩვენებთ ცოცხალ ფრენის დღეებს და გადაგიყვანთ ოპერატორის ოფიციალურ საიტზე გადახდისთვის.',
      'შეამოწმეთ შიდა ფრენების თარიღები',
      [
        {
          question: 'საქართველოს რომელ ქალაქებს შორის არის შიდა ფრენები?',
          answer: 'Vanilla Sky აკავშირებს თბილისს (ნატახტრის აეროპორტის გავლით), ბათუმს, მესტიას, ამბროლაურსა და ქუთაისს. ყველაზე პოპულარული მარშრუტებია თბილისი - მესტია, თბილისი - ბათუმი და ქუთაისი - მესტია.',
        },
        {
          question: 'შესაძლებელია შიდა ფრენის ბილეთის გადახდა GetFlights.ge-ზე?',
          answer: 'არა. GetFlights.ge ჯერ ცოცხალ ხელმისაწვდომობას აჩვენებს, გადახდა და ბილეთის გაფორმება კი Vanilla Sky-ის ოფიციალურ საიტზე ხდება — ჯავშანს ყოველთვის პირდაპირ ავიაკომპანიასთან აფორმებთ.',
        },
      ],
    ),
  },
  'vanilla-sky': {
    en: hub(
      'Buy Vanilla Sky tickets online — Georgia flight schedule | GetFlights.ge',
      'See live Vanilla Sky tickets online for every Georgian domestic route, check which days each flight operates, and finish booking on the official site ticket.vanillasky.ge.',
      'Buy Vanilla Sky tickets online',
      'Find every day Vanilla Sky is actually flying and buy your ticket in two steps: check live availability here, then pay on the official Vanilla Sky site at ticket.vanillasky.ge, part of the vanillasky.ge booking flow.',
      'Check Vanilla Sky ticket availability',
      [
        {
          question: 'How do I buy Vanilla Sky tickets online?',
          answer: 'Pick a route and date on GetFlights.ge to see live availability for every Vanilla Sky domestic flight, then continue to the official Vanilla Sky booking site at ticket.vanillasky.ge to pay and receive your ticket.',
        },
        {
          question: 'Which days does Vanilla Sky fly?',
          answer: 'Vanilla Sky flies between Tbilisi (Natakhtari airport), Batumi, Mestia, Ambrolauri, and Kutaisi on selected days rather than daily. GetFlights.ge shows the real bookable dates for each route, refreshed from the official booking system every few minutes.',
        },
        {
          question: 'Is GetFlights.ge the official Vanilla Sky website?',
          answer: 'No. GetFlights.ge is an independent flight-date search for Vanilla Sky routes. Payment and ticket issuance always happen on the official website ticket.vanillasky.ge, so your booking is made directly with the airline.',
        },
      ],
    ),
    ru: hub(
      'Купить билеты Vanilla Sky онлайн — расписание рейсов | GetFlights.ge',
      'Купить билеты Vanilla Sky онлайн: живые даты внутренних рейсов по Грузии и переход к официальной оплате на ticket.vanillasky.ge с одной страницы.',
      'Купить билеты Vanilla Sky онлайн',
      'Проверьте, в какие дни реально летает каждый внутренний рейс Vanilla Sky по Грузии, и купите билет в два шага: живая доступность здесь, оплата на официальном сайте Vanilla Sky — ticket.vanillasky.ge.',
      'Проверить доступность билетов Vanilla Sky',
      [
        {
          question: 'Как купить билеты Vanilla Sky онлайн?',
          answer: 'Выберите маршрут и дату на GetFlights.ge, чтобы увидеть живую доступность всех внутренних рейсов Vanilla Sky, затем перейдите на официальный сайт бронирования ticket.vanillasky.ge, чтобы оплатить и получить билет.',
        },
        {
          question: 'В какие дни летает Vanilla Sky?',
          answer: 'Vanilla Sky летает между Тбилиси (аэропорт Натахтари), Батуми, Местией, Амбролаури и Кутаиси в отдельные дни, а не ежедневно. GetFlights.ge показывает реальные даты по каждому маршруту и обновляет их из официальной системы бронирования каждые несколько минут.',
        },
        {
          question: 'GetFlights.ge — официальный сайт Vanilla Sky?',
          answer: 'Нет. GetFlights.ge — независимый поиск дат рейсов Vanilla Sky. Оплата и оформление билета всегда происходят на официальном сайте ticket.vanillasky.ge, поэтому бронирование оформляется напрямую у авиакомпании.',
        },
      ],
    ),
    ua: hub(
      'Купити квитки Vanilla Sky онлайн — розклад рейсів | GetFlights.ge',
      'Купити квитки Vanilla Sky онлайн: живі дати внутрішніх рейсів Грузією і перехід до офіційної оплати на ticket.vanillasky.ge з однієї сторінки.',
      'Купити квитки Vanilla Sky онлайн',
      'Перевірте, у які дні справді літає кожен внутрішній рейс Vanilla Sky Грузією, і купіть квиток у два кроки: жива наявність тут, оплата на офіційному сайті Vanilla Sky — ticket.vanillasky.ge.',
      'Перевірити наявність квитків Vanilla Sky',
      [
        {
          question: 'Як купити квитки Vanilla Sky онлайн?',
          answer: 'Оберіть маршрут і дату на GetFlights.ge, щоб побачити живу наявність усіх внутрішніх рейсів Vanilla Sky, потім перейдіть на офіційний сайт бронювання ticket.vanillasky.ge, щоб оплатити й отримати квиток.',
        },
        {
          question: 'У які дні літає Vanilla Sky?',
          answer: 'Vanilla Sky літає між Тбілісі (аеропорт Натахтарі), Батумі, Местією, Амбролаурі та Кутаїсі в окремі дні, а не щодня. GetFlights.ge показує реальні дати за кожним маршрутом і оновлює їх з офіційної системи бронювання кожні кілька хвилин.',
        },
        {
          question: 'GetFlights.ge — це офіційний сайт Vanilla Sky?',
          answer: 'Ні. GetFlights.ge — незалежний пошук дат рейсів Vanilla Sky. Оплата та оформлення квитка завжди відбуваються на офіційному сайті ticket.vanillasky.ge, тож бронювання здійснюється напряму в авіакомпанії.',
        },
      ],
    ),
    ka: hub(
      'Vanilla Sky ბილეთების ყიდვა ონლაინ — ფრენების განრიგი | GetFlights.ge',
      'იყიდეთ Vanilla Sky-ის ბილეთები ონლაინ: შიდა ფრენების ცოცხალი თარიღები საქართველოში და ოფიციალურ გადახდაზე გადასვლა ticket.vanillasky.ge-ზე ერთი გვერდიდან.',
      'Vanilla Sky ბილეთების ყიდვა ონლაინ',
      'შეამოწმეთ, რომელ დღეებში დაფრინავს რეალურად Vanilla Sky-ის თითოეული შიდა რეისი საქართველოში, და იყიდეთ ბილეთი ორ ნაბიჯში: ცოცხალი ხელმისაწვდომობა აქ, გადახდა კი Vanilla Sky-ის ოფიციალურ საიტზე — ticket.vanillasky.ge.',
      'შეამოწმეთ Vanilla Sky ბილეთების ხელმისაწვდომობა',
      [
        {
          question: 'როგორ ვიყიდო Vanilla Sky-ის ბილეთები ონლაინ?',
          answer: 'აირჩიეთ მარშრუტი და თარიღი GetFlights.ge-ზე, რომ ნახოთ Vanilla Sky-ის ყველა შიდა რეისის ცოცხალი ხელმისაწვდომობა, შემდეგ გადადით ოფიციალურ დაჯავშნის საიტზე ticket.vanillasky.ge გადახდისა და ბილეთის მისაღებად.',
        },
        {
          question: 'რომელ დღეებში დაფრინავს Vanilla Sky?',
          answer: 'Vanilla Sky დაფრინავს თბილისს (ნატახტრის აეროპორტი), ბათუმს, მესტიას, ამბროლაურსა და ქუთაისს შორის შერჩეულ დღეებში და არა ყოველდღე. GetFlights.ge აჩვენებს რეალურ თარიღებს თითოეული მარშრუტისთვის და ანახლებს მათ ოფიციალური სისტემიდან ყოველ რამდენიმე წუთში.',
        },
        {
          question: 'GetFlights.ge Vanilla Sky-ის ოფიციალური საიტია?',
          answer: 'არა. GetFlights.ge Vanilla Sky-ის რეისების თარიღების დამოუკიდებელი საძიებოა. გადახდა და ბილეთის გაფორმება ყოველთვის ოფიციალურ საიტზე ticket.vanillasky.ge ხდება, ასე რომ ჯავშანი პირდაპირ ავიაკომპანიასთან ფორმდება.',
        },
      ],
    ),
  },
  natakhtari: {
    en: hub(
      'Flights from Tbilisi via Natakhtari Airport | GetFlights.ge',
      'Check flights from Tbilisi via Natakhtari airport to Batumi, Mestia, and Ambrolauri with official Vanilla Sky booking handoff.',
      'Flights from Tbilisi via Natakhtari Airport',
      'Many Vanilla Sky flights from Tbilisi actually use Natakhtari airport near the city. This page explains that routing and links you to live Batumi, Mestia, and Ambrolauri availability.',
      'Check Natakhtari flight dates',
      [
        {
          question: 'Where is Natakhtari airport?',
          answer: 'Natakhtari is a small airfield about 30 kilometres north of Tbilisi, near Mtskheta. Vanilla Sky uses it as the Tbilisi departure point, so domestic flights sold as Tbilisi flights actually depart from Natakhtari.',
        },
        {
          question: 'Which routes fly from Natakhtari airport?',
          answer: 'Vanilla Sky flies from Natakhtari to Batumi, Mestia, and Ambrolauri, with matching return flights. GetFlights.ge lists the live departure dates for each of these routes.',
        },
      ],
    ),
    ru: hub(
      'Рейсы из аэропорта Натахтари рядом с Тбилиси | GetFlights.ge',
      'Проверяйте внутренние рейсы из аэропорта Натахтари рядом с Тбилиси в Батуми, Местию и Амбролаури с переходом к официальному бронированию Vanilla Sky.',
      'Рейсы из аэропорта Натахтари рядом с Тбилиси',
      'Многие рейсы Vanilla Sky, которые ищут как маршруты из Тбилиси, фактически используют аэропорт Натахтари рядом с городом. Эта страница объясняет маршрут и ведет к живой доступности Батуми, Местии и Амбролаури.',
      'Проверить даты рейсов Натахтари',
      [
        {
          question: 'Где находится аэропорт Натахтари?',
          answer: 'Натахтари — небольшой аэродром примерно в 30 километрах к северу от Тбилиси, рядом с Мцхетой. Vanilla Sky использует его как точку вылета из Тбилиси, поэтому внутренние рейсы «из Тбилиси» фактически вылетают из Натахтари.',
        },
        {
          question: 'Куда летают рейсы из аэропорта Натахтари?',
          answer: 'Vanilla Sky летает из Натахтари в Батуми, Местию и Амбролаури, а также обратными рейсами. GetFlights.ge показывает живые даты вылетов по каждому из этих маршрутов.',
        },
      ],
    ),
    ua: hub(
      'Рейси з аеропорту Натахтарі біля Тбілісі | GetFlights.ge',
      'Перевіряйте внутрішні рейси з аеропорту Натахтарі біля Тбілісі до Батумі, Местії та Амбролаурі з переходом до офіційного бронювання Vanilla Sky.',
      'Рейси з аеропорту Натахтарі біля Тбілісі',
      'Багато рейсів Vanilla Sky, які шукають як маршрути з Тбілісі, фактично використовують аеропорт Натахтарі поруч із містом. Ця сторінка пояснює маршрут і веде до живої наявності Батумі, Местії та Амбролаурі.',
      'Перевірити дати рейсів Натахтарі',
      [
        {
          question: 'Де знаходиться аеропорт Натахтарі?',
          answer: 'Натахтарі — невеликий аеродром приблизно за 30 кілометрів на північ від Тбілісі, поруч із Мцхетою. Vanilla Sky використовує його як точку вильоту з Тбілісі, тому внутрішні рейси «з Тбілісі» фактично вилітають з Натахтарі.',
        },
        {
          question: 'Куди літають рейси з аеропорту Натахтарі?',
          answer: 'Vanilla Sky літає з Натахтарі до Батумі, Местії та Амбролаурі, а також зворотними рейсами. GetFlights.ge показує живі дати вильотів за кожним із цих маршрутів.',
        },
      ],
    ),
    ka: hub(
      'ნატახტრის აეროპორტის ფრენები თბილისიდან | GetFlights.ge',
      'შეამოწმეთ შიდა ფრენები ნატახტრის აეროპორტიდან ბათუმში, მესტიასა და ამბროლაურში Vanilla Sky-ის ოფიციალურ დაჯავშნაზე გადასვლით.',
      'ნატახტრის აეროპორტის ფრენები თბილისიდან',
      'ბევრი Vanilla Sky რეისი, რომელსაც თბილისიდან ეძებენ, რეალურად ქალაქთან ახლოს მდებარე ნატახტრის აეროპორტს იყენებს. ეს გვერდი ხსნის მარშრუტს და გაჩვენებთ ბათუმის, მესტიისა და ამბროლაურის ცოცხალ ხელმისაწვდომობას.',
      'შეამოწმეთ ნატახტრის ფრენების თარიღები',
      [
        {
          question: 'სად მდებარეობს ნატახტრის აეროპორტი?',
          answer: 'ნატახტარი პატარა აეროდრომია თბილისიდან დაახლოებით 30 კილომეტრში, ჩრდილოეთით, მცხეთასთან ახლოს. Vanilla Sky მას თბილისის გასაფრენ წერტილად იყენებს, ამიტომ „თბილისიდან" გაყიდული შიდა რეისები რეალურად ნატახტრიდან გაფრინდება.',
        },
        {
          question: 'რომელი მარშრუტები დაფრინავს ნატახტრიდან?',
          answer: 'Vanilla Sky ნატახტრიდან დაფრინავს ბათუმში, მესტიასა და ამბროლაურში, შესაბამისი უკუ რეისებით. GetFlights.ge აჩვენებს გაფრენის ცოცხალ თარიღებს თითოეული ამ მარშრუტისთვის.',
        },
      ],
    ),
  },
};

export const routeSeoPages: RouteSeoPage[] = locales.flatMap((locale) => [
  ...hubs.map((hub) => buildHubPage(locale, hub)),
  ...routes.map((routeDefinition) => buildRoutePage(locale, routeDefinition)),
]);

function hub(title: string, description: string, h1: string, intro: string, cta: string, faqs: RouteSeoFaq[]) {
  return {
    title,
    description,
    h1,
    intro,
    cta,
    faqs,
  };
}

function normalizePath(pathname: string): `/${Locale}/${string}/` | string {
  const clean = `/${pathname.split('?')[0].split('#')[0].split('/').filter(Boolean).join('/')}/`;
  return clean === '//' ? '/' : clean;
}
