import type { Locale } from './i18n';

const SITE_ORIGIN = 'https://getflights.ge';
const VANILLA_SKY_GUIDE_SLUG = 'blog/vanilla-sky-georgia-flights-guide';
const HOW_TO_BUY_SLUG = 'blog/how-to-buy-vanilla-sky-tickets';
const NATAKHTARI_GUIDE_SLUG = 'blog/natakhtari-airport-guide';
const BAGGAGE_WEATHER_SLUG = 'blog/vanilla-sky-baggage-weather-cancellations';
const NLEVSHITS_TELEGRAM_URL = 'https://t.me/nlevshitstelegram';
const BLOG_PUBLISHED_AT = '2026-07-01';
const BLOG_UPDATED_AT = '2026-07-01';
const SEARCH_PREVIEW_IMAGE_PATH = '/vanilla-sky-georgia-flight-preview.png';

export type BlogSeoSection = {
  heading: string;
  body: string[];
};

export type BlogSeoRouteLink = {
  label: string;
  href: `/${Locale}/${string}/`;
};

export type BlogSeoPost = {
  locale: Locale;
  slug: string;
  path: `/${Locale}/${string}/`;
  title: string;
  description: string;
  h1: string;
  intro: string;
  cta: string;
  publishedAt: string;
  updatedAt: string;
  source?: {
    label: string;
    href: string;
  };
  image: {
    src: string;
    alt: string;
    caption: string;
  };
  routeLinks: BlogSeoRouteLink[];
  sections: BlogSeoSection[];
};

type BlogSeoPostContent = Omit<
  BlogSeoPost,
  'locale' | 'slug' | 'path' | 'publishedAt' | 'updatedAt' | 'source' | 'routeLinks'
>;

export type BlogSeoIndexPage = {
  locale: Locale;
  slug: 'blog';
  path: `/${Locale}/blog/`;
  title: string;
  description: string;
  h1: string;
  intro: string;
  posts: BlogSeoPost[];
};

const locales: Locale[] = ['en', 'ru', 'ua', 'ka'];
const articleSlugs = [VANILLA_SKY_GUIDE_SLUG, HOW_TO_BUY_SLUG, NATAKHTARI_GUIDE_SLUG, BAGGAGE_WEATHER_SLUG];

export function blogSeoPostsForLocale(locale: Locale) {
  return blogSeoPosts.filter((post) => post.locale === locale);
}

export function getBlogSeoPostByPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return blogSeoPosts.find((post) => post.path === normalized) ?? null;
}

export function blogSeoIndexPageForLocale(locale: Locale) {
  return blogSeoIndexPages.find((page) => page.locale === locale) ?? blogSeoIndexPages[0];
}

export function getBlogSeoIndexPageByPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return blogSeoIndexPages.find((page) => page.path === normalized) ?? null;
}

export function blogSeoPostUrl(post: BlogSeoPost) {
  return `${SITE_ORIGIN}${post.path}`;
}

export function blogSeoPostUrlForLocale(post: BlogSeoPost, locale: Locale) {
  return `${SITE_ORIGIN}/${locale}/${post.slug}/`;
}

export function blogSeoIndexPageUrl(page: BlogSeoIndexPage) {
  return `${SITE_ORIGIN}${page.path}`;
}

export function blogSeoIndexPageUrlForLocale(_page: BlogSeoIndexPage, locale: Locale) {
  return `${SITE_ORIGIN}/${locale}/blog/`;
}

function routeLinks(locale: Locale): BlogSeoRouteLink[] {
  const labels: Record<Locale, string[]> = {
    en: [
      'Check Tbilisi to Mestia flight dates',
      'Check Tbilisi to Batumi flight dates',
      'Check Tbilisi to Ambrolauri flight dates',
      'Check Kutaisi to Mestia flight dates',
    ],
    ru: [
      'Проверить рейсы Тбилиси - Местиа',
      'Проверить рейсы Тбилиси - Батуми',
      'Проверить рейсы Тбилиси - Амбролаури',
      'Проверить рейсы Кутаиси - Местиа',
    ],
    ua: [
      'Перевірити рейси Тбілісі - Местія',
      'Перевірити рейси Тбілісі - Батумі',
      'Перевірити рейси Тбілісі - Амбролаурі',
      'Перевірити рейси Кутаїсі - Местія',
    ],
    ka: [
      'შეამოწმეთ თბილისი - მესტიის ფრენები',
      'შეამოწმეთ თბილისი - ბათუმის ფრენები',
      'შეამოწმეთ თბილისი - ამბროლაურის ფრენები',
      'შეამოწმეთ ქუთაისი - მესტიის ფრენები',
    ],
  };
  const slugs = ['flights/tbilisi-mestia', 'flights/tbilisi-batumi', 'flights/tbilisi-ambrolauri', 'flights/kutaisi-mestia'];

  return slugs.map((slug, index) => ({
    label: labels[locale][index],
    href: `/${locale}/${slug}/`,
  }));
}

const sourceCopy: Record<Locale, BlogSeoPost['source']> = {
  en: { label: 'Nikolay Levshits on Telegram', href: NLEVSHITS_TELEGRAM_URL },
  ru: { label: 'Николай Левшиц в Telegram', href: NLEVSHITS_TELEGRAM_URL },
  ua: { label: 'Ніколай Левшиць у Telegram', href: NLEVSHITS_TELEGRAM_URL },
  ka: { label: 'ნიკოლაი ლევშიცი Telegram-ზე', href: NLEVSHITS_TELEGRAM_URL },
};

const guideCopy: Record<Locale, BlogSeoPostContent> = {
  en: {
    title: 'Vanilla Sky flights in Georgia: what to know before you book | GetFlights.ge',
    description:
      'Practical guide to Vanilla Sky domestic flights in Georgia: Natakhtari airport, Mestia and Ambrolauri routes, limited seats, baggage, weather cancellations, and booking tips.',
    h1: 'Vanilla Sky flights in Georgia: what to know before you book',
    intro:
      'Vanilla Sky makes some of Georgia’s most scenic domestic flights possible, including routes toward Svaneti and Racha. The experience can be memorable, but the booking process, airport choice, luggage rules, and weather risk are worth understanding before you plan around the flight.',
    cta: 'Check live Vanilla Sky flight dates',
    image: {
      src: SEARCH_PREVIEW_IMAGE_PATH,
      alt: "Small aircraft flying over Georgia's mountain routes",
      caption: 'GetFlights.ge helps travelers find live Vanilla Sky route dates before continuing to the official booking site.',
    },
    sections: [
      {
        heading: 'What Vanilla Sky is',
        body: [
          'Vanilla Sky is a small Georgian airline operating domestic flights between cities and mountain regions such as Mestia and Ambrolauri, depending on the active schedule.',
          'The flights are attractive because they can turn a long road trip into a short hop with mountain views, but availability is limited and seats can disappear quickly in summer.',
        ],
      },
      {
        heading: 'For Tbilisi routes, look for Natakhtari',
        body: [
          'If you are searching for a flight from the Tbilisi area, the booking system may list the departure point as Natakhtari rather than central Tbilisi.',
          'Natakhtari airport is outside the city. Travelers often mention the included transfer from Tbilisi, so check the current pickup details before departure.',
        ],
      },
      {
        heading: 'Small aircraft, limited seats, strict luggage',
        body: [
          'Traveler reports describe the route as a compact aircraft experience, often associated with the L-410 Turbolet. Capacity is small, so one sold-out date can remove a large share of available seats.',
          'Plan light. The commonly cited allowance is around 15 kg including hand luggage, but you should confirm the current rule on the official booking page before paying.',
        ],
      },
      {
        heading: 'Weather cancellations are part of the risk',
        body: [
          'Mountain flights can be sensitive to weather. Travelers report cancellations even close to departure time, including cases after baggage has already been checked.',
          'Do not put an immovable hotel, hiking pickup, or international flight immediately after a Vanilla Sky leg unless you have a backup plan.',
        ],
      },
      {
        heading: 'Why tickets feel difficult to buy',
        body: [
          'Demand is high in the warm season and the official ticket site can be hard to use. The practical move is to check several nearby dates and book as soon as a suitable flight appears.',
          'GetFlights.ge does not issue tickets itself. It shows live route dates and then sends you to Vanilla Sky’s official website to complete payment.',
        ],
      },
      {
        heading: 'Price and comfort expectations',
        body: [
          'The original travel note cited Natakhtari to Mestia at about 90 GEL and roughly 50-60 minutes in the air. Treat that as traveler context, not a fixed fare: always check the current price during booking.',
          'If you are sensitive to turbulence, expect a small-aircraft mountain flight to feel different from a large commercial jet.',
        ],
      },
    ],
  },
  ru: {
    title: 'Vanilla Sky по Грузии: что знать перед покупкой билета | GetFlights.ge',
    description:
      'Практический гид по рейсам Vanilla Sky в Грузии: аэропорт Натахтари, рейсы в Местию и Амбролаури, 16 мест, багаж, отмены из-за погоды и советы по покупке билетов.',
    h1: 'Vanilla Sky по Грузии: что знать перед покупкой билета',
    intro:
      'Vanilla Sky дает редкую возможность летать по Грузии внутри страны, в том числе в сторону Сванетии и Рачи. Это может быть один из самых красивых перелетов в поездке, но перед покупкой стоит понимать, где искать аэропорт, почему билеты быстро заканчиваются и какие ограничения бывают у таких рейсов.',
    cta: 'Проверить живые даты рейсов Vanilla Sky',
    image: {
      src: SEARCH_PREVIEW_IMAGE_PATH,
      alt: 'Небольшой самолет над горными маршрутами Грузии',
      caption: 'GetFlights.ge помогает найти живые даты маршрутов Vanilla Sky перед переходом на официальный сайт покупки.',
    },
    sections: [
      {
        heading: 'Что такое Vanilla Sky',
        body: [
          'Vanilla Sky — небольшая грузинская авиакомпания с внутренними рейсами между городами и горными регионами, включая Местию и Амбролаури в зависимости от актуального расписания.',
          'Главная причина интереса — время и виды: вместо долгой дороги можно получить короткий перелет над Кавказом. Минус — мест мало, а летом спрос высокий.',
        ],
      },
      {
        heading: 'Для рейсов из Тбилиси ищите Натахтари',
        body: [
          'В системе бронирования для тбилисского направления часто нужно выбирать не сам Тбилиси, а аэропорт Натахтари.',
          'Натахтари находится за городом. Путешественники часто упоминают трансфер из Тбилиси, но точку и время отправления лучше проверять перед вылетом.',
        ],
      },
      {
        heading: 'Маленький самолет, мало мест, строгий багаж',
        body: [
          'В заметках путешественников эти рейсы часто описывают как полет на компактном L-410 Turbolet. В салоне около 16 мест, поэтому даты быстро становятся недоступными.',
          'С багажом лучше ехать налегке. Часто называют лимит около 15 кг вместе с ручной кладью, но актуальное правило нужно проверять на официальной странице покупки.',
        ],
      },
      {
        heading: 'Погода может изменить план',
        body: [
          'Горные рейсы сильно зависят от погоды. Пассажиры рассказывают об отменах почти перед вылетом, иногда уже после сдачи багажа.',
          'Не ставьте сразу после такого перелета жесткую пересадку, оплаченную экскурсию или международный рейс без запаса времени.',
        ],
      },
      {
        heading: 'Почему билеты сложно купить',
        body: [
          'Летом ажиотаж высокий, а официальный сайт покупки может работать нестабильно. Практичнее проверять несколько соседних дат и оформлять билет сразу, когда он появился.',
          'GetFlights.ge не выпускает билеты сам. Мы показываем живые даты маршрутов и переводим на официальный сайт Vanilla Sky для оплаты.',
        ],
      },
      {
        heading: 'Цена и комфорт',
        body: [
          'В исходной заметке приводился ориентир около 90 лари за Натахтари - Местия и 50-60 минут в полете. Это контекст от путешественников, а не фиксированный тариф: цену нужно проверять при покупке.',
          'Если вы боитесь турбулентности, небольшой самолет в горах может ощущаться заметно иначе, чем обычный большой авиалайнер.',
        ],
      },
    ],
  },
  ua: {
    title: 'Vanilla Sky у Грузії: що знати перед купівлею квитка | GetFlights.ge',
    description:
      'Практичний гайд по рейсах Vanilla Sky у Грузії: аеропорт Натахтарі, рейси до Местії та Амбролаурі, місця, багаж, скасування через погоду і поради щодо купівлі квитків.',
    h1: 'Vanilla Sky у Грузії: що знати перед купівлею квитка',
    intro:
      'Vanilla Sky дає змогу літати всередині Грузії, зокрема у напрямку Сванетії та Рачі. Такий переліт може стати найяскравішою частиною подорожі, але перед покупкою варто розуміти, який аеропорт обирати, чому квитки швидко зникають і які обмеження є на цих рейсах.',
    cta: 'Перевірити живі дати рейсів Vanilla Sky',
    image: {
      src: SEARCH_PREVIEW_IMAGE_PATH,
      alt: 'Невеликий літак над гірськими маршрутами Грузії',
      caption: 'GetFlights.ge допомагає знайти живі дати маршрутів Vanilla Sky перед переходом на офіційний сайт купівлі.',
    },
    sections: [
      {
        heading: 'Що таке Vanilla Sky',
        body: [
          'Vanilla Sky — невелика грузинська авіакомпанія з внутрішніми рейсами між містами та гірськими регіонами, включно з Местією та Амбролаурі залежно від актуального розкладу.',
          'Ці рейси приваблюють часом у дорозі й видами: замість довгого переїзду можна отримати короткий переліт над Кавказом. Але місць мало, а влітку попит високий.',
        ],
      },
      {
        heading: 'Для рейсів із Тбілісі шукайте Натахтарі',
        body: [
          'У системі бронювання для тбіліського напрямку часто треба обирати не сам Тбілісі, а аеропорт Натахтарі.',
          'Натахтарі розташований за містом. Мандрівники часто згадують трансфер із Тбілісі, але точку та час відправлення краще перевіряти перед вильотом.',
        ],
      },
      {
        heading: 'Малий літак, мало місць, суворий багаж',
        body: [
          'У нотатках мандрівників ці рейси часто описують як політ на компактному L-410 Turbolet. У салоні небагато місць, тому доступні дати швидко зникають.',
          'З багажем краще їхати легко. Часто згадують ліміт близько 15 кг разом із ручною поклажею, але актуальне правило треба перевіряти на офіційній сторінці купівлі.',
        ],
      },
      {
        heading: 'Погода може змінити план',
        body: [
          'Гірські рейси сильно залежать від погоди. Пасажири розповідають про скасування майже перед вильотом, інколи вже після здавання багажу.',
          'Не ставте одразу після такого перельоту жорстку пересадку, оплачену екскурсію або міжнародний рейс без запасу часу.',
        ],
      },
      {
        heading: 'Чому квитки складно купити',
        body: [
          'Влітку попит високий, а офіційний сайт купівлі може працювати нестабільно. Практичніше перевіряти кілька сусідніх дат і оформлювати квиток одразу, коли він з’явився.',
          'GetFlights.ge не випускає квитки самостійно. Ми показуємо живі дати маршрутів і переводимо на офіційний сайт Vanilla Sky для оплати.',
        ],
      },
      {
        heading: 'Ціна і комфорт',
        body: [
          'В оригінальній нотатці згадувався орієнтир близько 90 ларі за Натахтарі - Местія і 50-60 хвилин у повітрі. Це контекст від мандрівників, а не фіксований тариф: ціну треба перевіряти під час купівлі.',
          'Якщо ви боїтеся турбулентності, невеликий літак у горах може відчуватися зовсім інакше, ніж великий комерційний літак.',
        ],
      },
    ],
  },
  ka: {
    title: 'Vanilla Sky საქართველოში: რა უნდა იცოდეთ ბილეთის ყიდვამდე | GetFlights.ge',
    description:
      'პრაქტიკული გზამკვლევი Vanilla Sky-ის შიდა ფრენებზე საქართველოში: ნატახტრის აეროპორტი, მესტია, ამბროლაური, ბარგი, ამინდის გამო გაუქმება და დაჯავშნის რჩევები.',
    h1: 'Vanilla Sky საქართველოში: რა უნდა იცოდეთ ბილეთის ყიდვამდე',
    intro:
      'Vanilla Sky საქართველოში შიდა ფრენის იშვიათ შესაძლებლობას იძლევა, მათ შორის სვანეთისა და რაჭის მიმართულებით. ფრენა შეიძლება ძალიან შთამბეჭდავი იყოს, მაგრამ დაგეგმვამდე ღირს იცოდეთ რომელი აეროპორტი აირჩიოთ, რატომ ქრება ბილეთები სწრაფად და რა შეზღუდვები აქვს ასეთ რეისებს.',
    cta: 'შეამოწმეთ Vanilla Sky-ის ცოცხალი ფრენის თარიღები',
    image: {
      src: SEARCH_PREVIEW_IMAGE_PATH,
      alt: 'პატარა თვითმფრინავი საქართველოს მთიან მარშრუტებზე',
      caption: 'GetFlights.ge გეხმარებათ Vanilla Sky-ის ცოცხალი თარიღების პოვნაში და გადახდაზე ოფიციალურ საიტზე გადაგიყვანთ.',
    },
    sections: [
      {
        heading: 'რა არის Vanilla Sky',
        body: [
          'Vanilla Sky არის მცირე ქართული ავიაკომპანია, რომელიც შიდა რეისებს ასრულებს ქალაქებსა და მთიან რეგიონებს შორის, მათ შორის მესტიისა და ამბროლაურის მიმართულებით, მოქმედი განრიგის მიხედვით.',
          'ამ რეისების მთავარი ღირებულებაა დრო და ხედები: გრძელი გზის ნაცვლად მიიღებთ მოკლე ფრენას კავკასიონის თავზე. მინუსი ის არის, რომ ადგილები ცოტაა და ზაფხულში მოთხოვნა მაღალია.',
        ],
      },
      {
        heading: 'თბილისის რეისებისთვის მოძებნეთ ნატახტარი',
        body: [
          'დაჯავშნის სისტემაში თბილისის მიმართულებისთვის ხშირად უნდა აირჩიოთ არა ქალაქი თბილისი, არამედ ნატახტრის აეროპორტი.',
          'ნატახტარი ქალაქგარეთ მდებარეობს. მოგზაურები ხშირად ახსენებენ ტრანსფერს თბილისიდან, მაგრამ გამგზავრების ადგილი და დრო აუცილებლად გადაამოწმეთ ფრენამდე.',
        ],
      },
      {
        heading: 'მცირე თვითმფრინავი, ცოტა ადგილი, მკაცრი ბარგი',
        body: [
          'მოგზაურების აღწერებში ეს რეისები ხშირად უკავშირდება კომპაქტურ L-410 Turbolet-ს. ადგილების რაოდენობა მცირეა, ამიტომ ხელმისაწვდომი თარიღები სწრაფად ივსება.',
          'ბარგი მსუბუქად დაგეგმეთ. ხშირად სახელდება დაახლოებით 15 კგ ლიმიტი ხელბარგის ჩათვლით, თუმცა მოქმედი წესი ოფიციალურ დაჯავშნის გვერდზე უნდა გადაამოწმოთ.',
        ],
      },
      {
        heading: 'ამინდმა შეიძლება გეგმა შეცვალოს',
        body: [
          'მთის რეისები ამინდზე ძლიერ არის დამოკიდებული. მგზავრები აღწერენ გაუქმებებს გაფრენამდე ცოტა ხნით ადრე, ზოგჯერ ბარგის ჩაბარების შემდეგაც.',
          'ასეთი ფრენის შემდეგ დაუყოვნებლივ ნუ დაგეგმავთ მკაცრ გადაჯდომას, გადახდილ ტურს ან საერთაშორისო რეისს დროის მარაგის გარეშე.',
        ],
      },
      {
        heading: 'რატომ არის ბილეთის ყიდვა რთული',
        body: [
          'ზაფხულში მოთხოვნა მაღალია, ხოლო ოფიციალური საიტი ზოგჯერ არასტაბილურად მუშაობს. პრაქტიკული მიდგომაა რამდენიმე ახლო თარიღის შემოწმება და ბილეთის მაშინვე გაფორმება, როცა გამოჩნდება.',
          'GetFlights.ge თვითონ არ გასცემს ბილეთებს. ჩვენ გაჩვენებთ მარშრუტების ცოცხალ თარიღებს და გადაგიყვანთ Vanilla Sky-ის ოფიციალურ საიტზე გადახდისთვის.',
        ],
      },
      {
        heading: 'ფასი და კომფორტი',
        body: [
          'საწყის მოგზაურის ჩანაწერში ნატახტარი - მესტიისთვის ნახსენებია დაახლოებით 90 ლარი და 50-60 წუთი ფრენაში. ეს არის მოგზაურის კონტექსტი და არა ფიქსირებული ტარიფი: ფასი შეამოწმეთ ყიდვისას.',
          'თუ ტურბულენტობის გეშინიათ, მცირე თვითმფრინავით მთებში ფრენა შეიძლება დიდი სამგზავრო თვითმფრინავისგან განსხვავებულად იგრძნოთ.',
        ],
      },
    ],
  },
};

const bookingCopy: Record<Locale, BlogSeoPostContent> = {
  en: article(
    'How to buy Vanilla Sky tickets online | GetFlights.ge',
    'Step-by-step guide to finding Vanilla Sky ticket dates, choosing the right route, and completing payment on the official Vanilla Sky booking site.',
    'How to buy Vanilla Sky tickets online',
    'Vanilla Sky tickets can be hard to find because each route flies only on selected days and popular dates sell out quickly. The practical workflow is to find a live date first, then finish the purchase on the official Vanilla Sky checkout.',
    'Check Vanilla Sky ticket dates',
    'Vanilla Sky booking search on GetFlights.ge with live route dates and official checkout handoff',
    'Find a live date first, then continue to the official Vanilla Sky site to pay.',
    [
      section('Start with the real route', [
        'For Tbilisi-area flights, the official booking system may use Natakhtari rather than central Tbilisi. If you search only for Tbilisi on the official site, you can miss the route you actually need.',
        'GetFlights.ge uses traveler-friendly route names such as Tbilisi to Mestia, then passes the correct official route to Vanilla Sky when you continue to booking.',
      ]),
      section('Check several nearby dates', [
        'Vanilla Sky does not fly every route every day. Search a few dates around your preferred day, especially for Mestia and Ambrolauri, where demand can be high in the warm season.',
        'If a date is visible and works for your plan, do not wait too long. Small aircraft capacity means one sold-out flight can remove the only practical option for that week.',
      ]),
      section('Complete payment on the official site', [
        'GetFlights.ge does not issue tickets or take payment. After you choose a route and date, we send you to the official Vanilla Sky checkout at ticket.vanillasky.ge to complete the purchase.',
        'If you search for vanillasky.ge or Vanilla Sky Georgia, use GetFlights.ge to find the live date first, then treat the official Vanilla Sky checkout as the source of truth for payment and ticket issuance.',
        'Before paying, confirm passenger names, baggage rules, departure point, transfer details, and the current cancellation policy on the official checkout page.',
      ]),
      section('Keep a backup plan', [
        'Domestic mountain flights can be affected by weather. Avoid placing a non-refundable tour, hotel transfer, or international flight immediately after a Vanilla Sky segment.',
        'The safest plan leaves enough buffer time to switch to road transport if the flight is cancelled or moved.',
      ]),
    ],
  ),
  ru: article(
    'Как купить билеты Vanilla Sky онлайн | GetFlights.ge',
    'Пошаговый гид: как найти даты билетов Vanilla Sky, выбрать правильный маршрут и завершить оплату на официальном сайте Vanilla Sky.',
    'Как купить билеты Vanilla Sky онлайн',
    'Билеты Vanilla Sky бывает сложно поймать: маршруты выполняются не каждый день, а популярные даты быстро заканчиваются. Рабочий подход — сначала найти живую дату, а затем завершить покупку на официальном сайте Vanilla Sky.',
    'Проверить даты билетов Vanilla Sky',
    'Поиск билетов Vanilla Sky на GetFlights.ge с живыми датами маршрутов и переходом к официальной оплате',
    'Сначала найдите живую дату, затем переходите на официальный сайт Vanilla Sky для оплаты.',
    [
      section('Начните с правильного маршрута', [
        'Для рейсов из района Тбилиси официальная система может использовать Натахтари, а не сам Тбилиси. Если искать только Тбилиси, нужный рейс можно не увидеть.',
        'GetFlights.ge показывает понятные названия вроде Тбилиси - Местиа, а при переходе к покупке передает Vanilla Sky правильный официальный маршрут.',
      ]),
      section('Проверяйте соседние даты', [
        'Vanilla Sky летает не каждый день по каждому направлению. Смотрите несколько дат вокруг нужного дня, особенно для Местии и Амбролаури, где летом высокий спрос.',
        'Если дата подходит, лучше не откладывать. Самолеты небольшие, поэтому один распроданный рейс может быть единственным удобным вариантом на неделю.',
      ]),
      section('Оплата проходит на официальном сайте', [
        'GetFlights.ge не выпускает билеты и не принимает оплату. После выбора маршрута и даты мы переводим вас на официальный сайт Vanilla Sky для завершения покупки.',
        'Перед оплатой проверьте имена пассажиров, правила багажа, аэропорт вылета, детали трансфера и актуальные условия отмены на официальной странице.',
      ]),
      section('Держите запасной план', [
        'Внутренние рейсы в горные регионы зависят от погоды. Не ставьте сразу после перелета невозвратную экскурсию, трансфер или международный рейс.',
        'Надежнее оставить запас времени, чтобы при отмене или переносе рейса успеть перейти на наземный транспорт.',
      ]),
    ],
  ),
  ua: article(
    'Як купити квитки Vanilla Sky онлайн | GetFlights.ge',
    'Покроковий гайд: як знайти дати квитків Vanilla Sky, вибрати правильний маршрут і завершити оплату на офіційному сайті Vanilla Sky.',
    'Як купити квитки Vanilla Sky онлайн',
    'Квитки Vanilla Sky буває складно зловити: маршрути виконуються не щодня, а популярні дати швидко зникають. Практичний підхід — спочатку знайти живу дату, а потім завершити купівлю на офіційному сайті Vanilla Sky.',
    'Перевірити дати квитків Vanilla Sky',
    'Пошук квитків Vanilla Sky на GetFlights.ge з живими датами маршрутів і переходом до офіційної оплати',
    'Спочатку знайдіть живу дату, потім переходьте на офіційний сайт Vanilla Sky для оплати.',
    [
      section('Почніть із правильного маршруту', [
        'Для рейсів із району Тбілісі офіційна система може використовувати Натахтарі, а не сам Тбілісі. Якщо шукати тільки Тбілісі, потрібний рейс можна не побачити.',
        'GetFlights.ge показує зрозумілі назви на кшталт Тбілісі - Местія, а під час переходу до купівлі передає Vanilla Sky правильний офіційний маршрут.',
      ]),
      section('Перевіряйте сусідні дати', [
        'Vanilla Sky літає не щодня за кожним напрямком. Дивіться кілька дат навколо потрібного дня, особливо для Местії та Амбролаурі, де влітку високий попит.',
        'Якщо дата підходить, краще не відкладати. Літаки невеликі, тому один розпроданий рейс може бути єдиним зручним варіантом на тиждень.',
      ]),
      section('Оплата проходить на офіційному сайті', [
        'GetFlights.ge не випускає квитки і не приймає оплату. Після вибору маршруту й дати ми переводимо вас на офіційний сайт Vanilla Sky для завершення купівлі.',
        'Перед оплатою перевірте імена пасажирів, правила багажу, аеропорт вильоту, деталі трансферу та актуальні умови скасування на офіційній сторінці.',
      ]),
      section('Майте запасний план', [
        'Внутрішні рейси в гірські регіони залежать від погоди. Не ставте одразу після перельоту невідшкодовну екскурсію, трансфер або міжнародний рейс.',
        'Надійніше залишити запас часу, щоб у разі скасування або перенесення рейсу встигнути перейти на наземний транспорт.',
      ]),
    ],
  ),
  ka: article(
    'როგორ ვიყიდოთ Vanilla Sky-ის ბილეთები ონლაინ | GetFlights.ge',
    'ნაბიჯ-ნაბიჯ გზამკვლევი: როგორ იპოვოთ Vanilla Sky-ის ბილეთის თარიღები, აირჩიოთ სწორი მარშრუტი და გადაიხადოთ ოფიციალურ საიტზე.',
    'როგორ ვიყიდოთ Vanilla Sky-ის ბილეთები ონლაინ',
    'Vanilla Sky-ის ბილეთების პოვნა ზოგჯერ რთულია: ყველა მარშრუტი ყოველდღე არ სრულდება და პოპულარული თარიღები სწრაფად ივსება. პრაქტიკული გზა არის ჯერ ცოცხალი თარიღის პოვნა, შემდეგ კი შეძენის დასრულება Vanilla Sky-ის ოფიციალურ საიტზე.',
    'შეამოწმეთ Vanilla Sky-ის ბილეთის თარიღები',
    'Vanilla Sky-ის ბილეთების ძიება GetFlights.ge-ზე ცოცხალი თარიღებით და ოფიციალურ გადახდაზე გადასვლით',
    'ჯერ იპოვეთ ცოცხალი თარიღი, შემდეგ გადაიხადეთ Vanilla Sky-ის ოფიციალურ საიტზე.',
    [
      section('დაიწყეთ სწორი მარშრუტით', [
        'თბილისის რეგიონის რეისებისთვის ოფიციალურმა სისტემამ შეიძლება გამოიყენოს ნატახტარი და არა ქალაქი თბილისი. თუ მხოლოდ თბილისს ეძებთ, საჭირო რეისი შეიძლება ვერ ნახოთ.',
        'GetFlights.ge აჩვენებს მგზავრისთვის გასაგებ სახელებს, მაგალითად თბილისი - მესტია, ხოლო დაჯავშნაზე გადასვლისას Vanilla Sky-ს სწორ ოფიციალურ მარშრუტს უგზავნის.',
      ]),
      section('შეამოწმეთ ახლომდებარე თარიღები', [
        'Vanilla Sky ყველა მიმართულებით ყოველდღე არ დაფრინავს. შეამოწმეთ რამდენიმე ახლო თარიღი, განსაკუთრებით მესტიისა და ამბროლაურისთვის, სადაც ზაფხულში მოთხოვნა მაღალია.',
        'თუ თარიღი გერგებათ, გადადება არ ღირს. თვითმფრინავი პატარაა და ერთი გაყიდული რეისი შეიძლება კვირის ერთადერთი მოსახერხებელი ვარიანტი იყოს.',
      ]),
      section('გადახდა ოფიციალურ საიტზე სრულდება', [
        'GetFlights.ge ბილეთებს თვითონ არ გასცემს და გადახდას არ იღებს. მარშრუტისა და თარიღის არჩევის შემდეგ Vanilla Sky-ის ოფიციალურ საიტზე გადაგიყვანთ შეძენის დასასრულებლად.',
        'გადახდამდე გადაამოწმეთ მგზავრების სახელები, ბარგის წესები, გამგზავრების აეროპორტი, ტრანსფერის დეტალები და გაუქმების მოქმედი პირობები ოფიციალურ გვერდზე.',
      ]),
      section('დაიტოვეთ ალტერნატიული გეგმა', [
        'მთიან რეგიონებში შიდა ფრენები ამინდზეა დამოკიდებული. ასეთი ფრენის შემდეგ დაუყოვნებლივ ნუ დაგეგმავთ დაუბრუნებელ ტურს, ტრანსფერს ან საერთაშორისო რეისს.',
        'უფრო საიმედოა დროის მარაგი, რომ გაუქმების ან გადატანის შემთხვევაში სახმელეთო ტრანსპორტზე გადასვლა შეძლოთ.',
      ]),
    ],
  ),
};

const natakhtariCopy: Record<Locale, BlogSeoPostContent> = {
  en: article(
    'Natakhtari airport guide for Vanilla Sky flights from Tbilisi | GetFlights.ge',
    'What to know about Natakhtari airport near Tbilisi: Vanilla Sky routes, Novo Alexeyevka confusion, transfer expectations, and planning tips.',
    'Natakhtari airport: what to know before your Vanilla Sky flight',
    'Many travelers search for flights from Tbilisi, but Vanilla Sky often uses Natakhtari airport for Tbilisi-area domestic routes. Understanding that naming avoids booking confusion and helps you plan the start of the trip.',
    'Check Natakhtari flight routes',
    'Natakhtari airport guide for Vanilla Sky domestic flights from the Tbilisi area',
    'Natakhtari is the Tbilisi-area departure point used by many Vanilla Sky domestic routes.',
    [
      section('Why Natakhtari appears instead of Tbilisi', [
        'Natakhtari airport is outside central Tbilisi, but it is used for several Vanilla Sky domestic routes that travelers commonly describe as leaving from Tbilisi.',
        'When a route page says Tbilisi to Mestia or Tbilisi to Batumi, check the official booking step for the exact airport name before departure.',
      ]),
      section('Novo Alexeyevka is not Natakhtari airport', [
        'Novo Alexeyevka is an older name associated with Tbilisi International Airport, not the Natakhtari airport used by Vanilla Sky domestic flights from the Tbilisi area.',
        'If your search says Novo Alexeyevka, Tbilisi International Airport, or TBS, double-check the route: Vanilla Sky domestic pages usually point you toward Natakhtari instead.',
      ]),
      section('Routes to check from Natakhtari', [
        'Common searches include Tbilisi to Mestia, Tbilisi to Ambrolauri, and Tbilisi to Batumi. Availability depends on the active schedule and can change by season.',
        'Use the route pages to find live dates first, then confirm the official route name and pickup details during checkout.',
      ]),
      section('Transfer and timing', [
        'Travelers often mention an included transfer from Tbilisi, but pickup details can change. Treat the official booking confirmation as the source of truth.',
        'Leave time for city traffic and for the transfer. Natakhtari is not a metro-access airport in the center of Tbilisi.',
      ]),
      section('Before you leave for the airport', [
        'Recheck your flight status, baggage allowance, and any weather notices before heading out.',
        'If the flight is important for a same-day connection, prepare a road backup in advance.',
      ]),
    ],
  ),
  ru: article(
    'Аэропорт Натахтари для рейсов Vanilla Sky | GetFlights.ge',
    'Что знать об аэропорте Натахтари рядом с Тбилиси: какие рейсы Vanilla Sky его используют, как читать название маршрута, трансфер и планирование.',
    'Аэропорт Натахтари: что знать перед рейсом',
    'Многие ищут рейсы из Тбилиси, но Vanilla Sky часто использует аэропорт Натахтари для внутренних маршрутов из тбилисского района. Если понимать это заранее, меньше риска выбрать не тот пункт вылета.',
    'Проверить маршруты из Натахтари',
    'Гид по аэропорту Натахтари для внутренних рейсов Vanilla Sky из района Тбилиси',
    'Натахтари — точка вылета рядом с Тбилиси для многих внутренних рейсов Vanilla Sky.',
    [
      section('Почему вместо Тбилиси указан Натахтари', [
        'Аэропорт Натахтари находится за пределами центра Тбилиси, но используется для нескольких внутренних рейсов Vanilla Sky, которые путешественники обычно называют рейсами из Тбилиси.',
        'Если страница маршрута называется Тбилиси - Местиа или Тбилиси - Батуми, перед выездом проверьте точное официальное название аэропорта на этапе покупки.',
      ]),
      section('Какие маршруты смотреть из Натахтари', [
        'Частые запросы — Тбилиси - Местиа, Тбилиси - Амбролаури и Тбилиси - Батуми. Доступность зависит от действующего расписания и сезона.',
        'Сначала найдите живые даты на страницах маршрутов, затем подтвердите официальное название маршрута и детали трансфера при покупке.',
      ]),
      section('Трансфер и время', [
        'Путешественники часто упоминают включенный трансфер из Тбилиси, но детали посадки могут меняться. Источником правды остается официальное подтверждение бронирования.',
        'Заложите время на городской трафик и сам трансфер. Натахтари — не аэропорт в центре Тбилиси с доступом на метро.',
      ]),
      section('Перед выездом в аэропорт', [
        'Перед выездом еще раз проверьте статус рейса, норму багажа и сообщения о погоде.',
        'Если рейс важен для пересадки в тот же день, заранее продумайте наземную альтернативу.',
      ]),
    ],
  ),
  ua: article(
    'Аеропорт Натахтарі для рейсів Vanilla Sky | GetFlights.ge',
    'Що знати про аеропорт Натахтарі біля Тбілісі: які рейси Vanilla Sky його використовують, як читати назву маршруту, трансфер і планування.',
    'Аеропорт Натахтарі: що знати перед рейсом',
    'Багато хто шукає рейси з Тбілісі, але Vanilla Sky часто використовує аеропорт Натахтарі для внутрішніх маршрутів із тбіліського району. Якщо розуміти це заздалегідь, менше ризику вибрати не той пункт вильоту.',
    'Перевірити маршрути з Натахтарі',
    'Гайд по аеропорту Натахтарі для внутрішніх рейсів Vanilla Sky із району Тбілісі',
    'Натахтарі — точка вильоту біля Тбілісі для багатьох внутрішніх рейсів Vanilla Sky.',
    [
      section('Чому замість Тбілісі вказано Натахтарі', [
        'Аеропорт Натахтарі розташований поза центром Тбілісі, але використовується для кількох внутрішніх рейсів Vanilla Sky, які мандрівники зазвичай називають рейсами з Тбілісі.',
        'Якщо сторінка маршруту називається Тбілісі - Местія або Тбілісі - Батумі, перед виїздом перевірте точну офіційну назву аеропорту на етапі купівлі.',
      ]),
      section('Які маршрути дивитися з Натахтарі', [
        'Часті запити — Тбілісі - Местія, Тбілісі - Амбролаурі та Тбілісі - Батумі. Доступність залежить від чинного розкладу й сезону.',
        'Спочатку знайдіть живі дати на сторінках маршрутів, потім підтвердьте офіційну назву маршруту та деталі трансферу під час купівлі.',
      ]),
      section('Трансфер і час', [
        'Мандрівники часто згадують включений трансфер із Тбілісі, але деталі посадки можуть змінюватися. Джерелом правди лишається офіційне підтвердження бронювання.',
        'Закладіть час на міський трафік і сам трансфер. Натахтарі — не аеропорт у центрі Тбілісі з доступом на метро.',
      ]),
      section('Перед виїздом в аеропорт', [
        'Перед виїздом ще раз перевірте статус рейсу, норму багажу та повідомлення про погоду.',
        'Якщо рейс важливий для пересадки того самого дня, заздалегідь продумайте наземну альтернативу.',
      ]),
    ],
  ),
  ka: article(
    'ნატახტრის აეროპორტის გზამკვლევი Vanilla Sky-ისთვის | GetFlights.ge',
    'რა უნდა იცოდეთ ნატახტრის აეროპორტზე თბილისთან ახლოს: რომელი Vanilla Sky მარშრუტები იყენებს მას, ტრანსფერი და დაგეგმვის რჩევები.',
    'ნატახტრის აეროპორტი: რა უნდა იცოდეთ ფრენამდე',
    'ბევრი მგზავრი თბილისიდან ფრენებს ეძებს, მაგრამ Vanilla Sky თბილისის რეგიონის შიდა მარშრუტებისთვის ხშირად ნატახტრის აეროპორტს იყენებს. ამის ცოდნა დაჯავშნის დაბნეულობას ამცირებს.',
    'შეამოწმეთ ნატახტრის მარშრუტები',
    'ნატახტრის აეროპორტის გზამკვლევი Vanilla Sky-ის შიდა რეისებისთვის თბილისის რეგიონიდან',
    'ნატახტარი არის თბილისის რეგიონის გამგზავრების წერტილი Vanilla Sky-ის მრავალი შიდა რეისისთვის.',
    [
      section('რატომ ჩანს თბილისი ნაცვლად ნატახტარი', [
        'ნატახტრის აეროპორტი თბილისის ცენტრს გარეთ მდებარეობს, მაგრამ Vanilla Sky-ის რამდენიმე შიდა რეისისთვის გამოიყენება, რომლებსაც მგზავრები ხშირად თბილისიდან რეისებს უწოდებენ.',
        'თუ მარშრუტის გვერდზე წერია თბილისი - მესტია ან თბილისი - ბათუმი, გამგზავრებამდე ოფიციალურ შეძენის ნაბიჯზე ზუსტი აეროპორტის სახელი გადაამოწმეთ.',
      ]),
      section('რომელი მარშრუტები შევამოწმოთ ნატახტრიდან', [
        'ხშირი ძიებებია თბილისი - მესტია, თბილისი - ამბროლაური და თბილისი - ბათუმი. ხელმისაწვდომობა მოქმედ განრიგსა და სეზონზეა დამოკიდებული.',
        'ჯერ იპოვეთ ცოცხალი თარიღები მარშრუტის გვერდებზე, შემდეგ კი ოფიციალური მარშრუტის სახელი და ტრანსფერის დეტალები შეძენისას დაადასტურეთ.',
      ]),
      section('ტრანსფერი და დრო', [
        'მგზავრები ხშირად ახსენებენ თბილისიდან ჩართულ ტრანსფერს, მაგრამ ჩასხდომის დეტალები შეიძლება შეიცვალოს. მთავარ წყაროდ ოფიციალური დაჯავშნის დადასტურება მიიჩნიეთ.',
        'დაიტოვეთ დრო ქალაქის მოძრაობისა და ტრანსფერისთვის. ნატახტარი თბილისის ცენტრში მდებარე მეტროთი მისასვლელი აეროპორტი არ არის.',
      ]),
      section('აეროპორტში გასვლამდე', [
        'გასვლამდე გადაამოწმეთ რეისის სტატუსი, ბარგის ნორმა და ამინდის შეტყობინებები.',
        'თუ რეისი იმავე დღის გადაჯდომისთვის მნიშვნელოვანია, სახმელეთო ალტერნატივა წინასწარ მოამზადეთ.',
      ]),
    ],
  ),
};

const baggageWeatherCopy: Record<Locale, BlogSeoPostContent> = {
  en: article(
    'Vanilla Sky baggage and weather cancellation guide | GetFlights.ge',
    'Plan for Vanilla Sky domestic flights with practical notes on baggage limits, small aircraft, mountain weather cancellations, refunds, and backup travel plans.',
    'Vanilla Sky baggage and weather cancellation guide',
    'Vanilla Sky flights are useful because they shorten difficult road journeys, but small aircraft and mountain weather make planning different from a normal airport trip. Check the rules before payment and leave room for changes.',
    'Check routes before planning around the flight',
    'Vanilla Sky baggage and weather planning guide for domestic flights in Georgia',
    'Small aircraft and mountain weather make Vanilla Sky flights worth planning with extra care.',
    [
      section('Pack lighter than usual', [
        'Traveler reports often mention a compact allowance around 15 kg including hand luggage. Treat that as planning context, then confirm the current rule on the official checkout page.',
        'If your trip includes hiking gear, ski gear, or large suitcases, check whether the flight still makes sense before you buy.',
      ]),
      section('Expect a small-aircraft experience', [
        'Vanilla Sky routes are commonly associated with small aircraft and limited seating. The flight can be scenic, but it may feel different from a large commercial jet.',
        'Passengers sensitive to turbulence should plan mentally for a short mountain flight rather than a standard airline cabin.',
      ]),
      section('Weather can cancel the flight', [
        'Mountain routes are sensitive to visibility and weather. Cancellations can happen close to departure, so do not build a tight same-day chain around one flight.',
        'If you must reach Mestia, Ambrolauri, Batumi, or Tbilisi that day, know the road alternative before you leave.',
      ]),
      section('Refund and rebooking checks', [
        'Refund timing and rebooking rules belong to Vanilla Sky, not GetFlights.ge. Confirm the current policy on the official booking site before payment.',
        'Keep the card and email used for booking available, because airline communication and refunds normally follow the official booking record.',
      ]),
    ],
  ),
  ru: article(
    'Багаж и отмены Vanilla Sky из-за погоды | GetFlights.ge',
    'Как планировать рейсы Vanilla Sky: багаж, небольшой самолет, отмены из-за погоды, возвраты и запасной маршрут по земле.',
    'Багаж Vanilla Sky и отмены из-за погоды',
    'Рейсы Vanilla Sky удобны, потому что сокращают сложные дороги по Грузии, но маленький самолет и горная погода требуют более осторожного планирования. Перед оплатой проверьте правила и оставьте место для изменений.',
    'Проверить маршруты перед планированием',
    'Гид по багажу и погодным рискам Vanilla Sky для внутренних рейсов по Грузии',
    'Небольшие самолеты и горная погода требуют планировать рейсы Vanilla Sky с запасом.',
    [
      section('Берите меньше багажа', [
        'В отзывах путешественников часто упоминается лимит около 15 кг вместе с ручной кладью. Используйте это как ориентир, но актуальное правило проверяйте на официальной странице оплаты.',
        'Если в поездке есть походное снаряжение, лыжи или большие чемоданы, заранее оцените, подходит ли такой перелет.',
      ]),
      section('Ожидайте небольшой самолет', [
        'Маршруты Vanilla Sky обычно связывают с небольшими самолетами и ограниченным числом мест. Перелет может быть красивым, но ощущения отличаются от большого лайнера.',
        'Если вы чувствительны к турбулентности, воспринимайте это как короткий горный перелет, а не как обычный рейс крупной авиакомпании.',
      ]),
      section('Погода может отменить рейс', [
        'Горные маршруты зависят от видимости и погоды. Отмена может случиться близко к вылету, поэтому не строите жесткую цепочку планов вокруг одного рейса.',
        'Если вам обязательно нужно попасть в Местию, Амбролаури, Батуми или Тбилиси в тот же день, заранее знайте наземную альтернативу.',
      ]),
      section('Возврат и перенос', [
        'Сроки возврата и правила переноса определяет Vanilla Sky, а не GetFlights.ge. Проверьте актуальную политику на официальном сайте перед оплатой.',
        'Держите под рукой карту и email, использованные при покупке: коммуникация и возврат обычно идут по официальной записи бронирования.',
      ]),
    ],
  ),
  ua: article(
    'Багаж і скасування Vanilla Sky через погоду | GetFlights.ge',
    'Як планувати рейси Vanilla Sky: багаж, невеликий літак, скасування через погоду, повернення коштів і запасний маршрут землею.',
    'Багаж Vanilla Sky і скасування через погоду',
    'Рейси Vanilla Sky зручні, бо скорочують складні дороги Грузією, але малий літак і гірська погода потребують обережнішого планування. Перед оплатою перевірте правила й залиште місце для змін.',
    'Перевірити маршрути перед плануванням',
    'Гайд по багажу та погодних ризиках Vanilla Sky для внутрішніх рейсів Грузією',
    'Невеликі літаки й гірська погода потребують планувати рейси Vanilla Sky із запасом.',
    [
      section('Беріть менше багажу', [
        'У відгуках мандрівників часто згадується ліміт близько 15 кг разом із ручною поклажею. Використовуйте це як орієнтир, але актуальне правило перевіряйте на офіційній сторінці оплати.',
        'Якщо в подорожі є похідне спорядження, лижі або великі валізи, заздалегідь оцініть, чи підходить такий переліт.',
      ]),
      section('Очікуйте невеликий літак', [
        'Маршрути Vanilla Sky зазвичай повʼязують із невеликими літаками та обмеженою кількістю місць. Переліт може бути красивим, але відчуття відрізняються від великого лайнера.',
        'Якщо ви чутливі до турбулентності, сприймайте це як короткий гірський переліт, а не як звичайний рейс великої авіакомпанії.',
      ]),
      section('Погода може скасувати рейс', [
        'Гірські маршрути залежать від видимості й погоди. Скасування може статися близько до вильоту, тому не будуйте жорсткий ланцюжок планів навколо одного рейсу.',
        'Якщо вам обовʼязково потрібно потрапити до Местії, Амбролаурі, Батумі або Тбілісі того самого дня, заздалегідь знайте наземну альтернативу.',
      ]),
      section('Повернення і перенесення', [
        'Строки повернення й правила перенесення визначає Vanilla Sky, а не GetFlights.ge. Перевірте актуальну політику на офіційному сайті перед оплатою.',
        'Тримайте під рукою картку й email, використані під час купівлі: комунікація та повернення зазвичай ідуть за офіційним записом бронювання.',
      ]),
    ],
  ),
  ka: article(
    'Vanilla Sky-ის ბარგი და ამინდით გაუქმება | GetFlights.ge',
    'როგორ დაგეგმოთ Vanilla Sky-ის რეისები: ბარგი, მცირე თვითმფრინავი, ამინდით გაუქმება, დაბრუნება და სახმელეთო ალტერნატივა.',
    'Vanilla Sky-ის ბარგი და ამინდით გაუქმება',
    'Vanilla Sky-ის ფრენები რთულ გზებს ამოკლებს, მაგრამ მცირე თვითმფრინავი და მთის ამინდი ჩვეულებრივი აეროპორტის მგზავრობისგან განსხვავებულ დაგეგმვას მოითხოვს. გადახდამდე წესები გადაამოწმეთ და ცვლილებებისთვის დრო დაიტოვეთ.',
    'შეამოწმეთ მარშრუტები დაგეგმვამდე',
    'Vanilla Sky-ის ბარგისა და ამინდის რისკების გზამკვლევი საქართველოს შიდა ფრენებისთვის',
    'მცირე თვითმფრინავი და მთის ამინდი Vanilla Sky-ის რეისების უფრო ფრთხილად დაგეგმვას მოითხოვს.',
    [
      section('ბარგი მსუბუქად დაგეგმეთ', [
        'მგზავრების გამოცდილებაში ხშირად სახელდება დაახლოებით 15 კგ ლიმიტი ხელბარგის ჩათვლით. ეს გამოიყენეთ როგორც დაგეგმვის კონტექსტი, მაგრამ მოქმედი წესი ოფიციალურ გადახდის გვერდზე გადაამოწმეთ.',
        'თუ გაქვთ სალაშქრო აღჭურვილობა, თხილამურები ან დიდი ჩემოდნები, ყიდვამდე შეაფასეთ, გერგებათ თუ არა ასეთი ფრენა.',
      ]),
      section('ელოდეთ მცირე თვითმფრინავს', [
        'Vanilla Sky-ის მარშრუტები ხშირად მცირე თვითმფრინავებსა და შეზღუდულ ადგილებს უკავშირდება. ფრენა შეიძლება ძალიან ლამაზი იყოს, მაგრამ დიდი კომერციული თვითმფრინავისგან განსხვავებულად იგრძნობა.',
        'თუ ტურბულენტობას მგრძნობიარედ აღიქვამთ, ეს მოკლე მთის ფრენად ჩათვალეთ და არა ჩვეულებრივ ავიარეისად.',
      ]),
      section('ამინდმა შეიძლება რეისი გააუქმოს', [
        'მთის მარშრუტები ხილვადობასა და ამინდზეა დამოკიდებული. გაუქმება შეიძლება გამგზავრებამდე ცოტა ხნით ადრე მოხდეს, ამიტომ ერთი ფრენის გარშემო მკაცრ გეგმებს ნუ ააწყობთ.',
        'თუ იმავე დღეს მესტიაში, ამბროლაურში, ბათუმში ან თბილისში აუცილებლად უნდა ჩახვიდეთ, სახმელეთო ალტერნატივა წინასწარ იცოდეთ.',
      ]),
      section('დაბრუნება და გადატანა', [
        'თანხის დაბრუნებისა და გადატანის წესებს Vanilla Sky განსაზღვრავს, არა GetFlights.ge. გადახდამდე მოქმედი პოლიტიკა ოფიციალურ საიტზე გადაამოწმეთ.',
        'ხელმისაწვდომად გქონდეთ ბარათი და email, რომლითაც იყიდეთ: კომუნიკაცია და დაბრუნება ჩვეულებრივ ოფიციალურ ჯავშანს მიყვება.',
      ]),
    ],
  ),
};

const articleCopies: Record<string, Record<Locale, BlogSeoPostContent>> = {
  [VANILLA_SKY_GUIDE_SLUG]: guideCopy,
  [HOW_TO_BUY_SLUG]: bookingCopy,
  [NATAKHTARI_GUIDE_SLUG]: natakhtariCopy,
  [BAGGAGE_WEATHER_SLUG]: baggageWeatherCopy,
};

const indexCopy: Record<Locale, Omit<BlogSeoIndexPage, 'locale' | 'slug' | 'path' | 'posts'>> = {
  en: {
    title: 'Vanilla Sky ticket guides | GetFlights.ge',
    description: 'Practical guides for buying Vanilla Sky tickets in Georgia, using Natakhtari airport, planning baggage, and preparing for weather changes.',
    h1: 'Vanilla Sky ticket guides',
    intro: 'Read practical guides before booking domestic Vanilla Sky flights in Georgia. These articles explain the official booking handoff, Natakhtari airport, baggage limits, weather cancellations, and route planning.',
  },
  ru: {
    title: 'Гиды по билетам Vanilla Sky | GetFlights.ge',
    description: 'Практические гиды по покупке билетов Vanilla Sky в Грузии, аэропорту Натахтари, багажу, отменам из-за погоды и планированию маршрута.',
    h1: 'Гиды по билетам Vanilla Sky',
    intro: 'Прочитайте практические гиды перед покупкой внутренних рейсов Vanilla Sky по Грузии. Здесь объясняем официальный переход к покупке, аэропорт Натахтари, багаж, погодные отмены и планирование маршрута.',
  },
  ua: {
    title: 'Гайди по квитках Vanilla Sky | GetFlights.ge',
    description: 'Практичні гайди з купівлі квитків Vanilla Sky у Грузії, аеропорту Натахтарі, багажу, скасувань через погоду і планування маршруту.',
    h1: 'Гайди по квитках Vanilla Sky',
    intro: 'Прочитайте практичні гайди перед купівлею внутрішніх рейсів Vanilla Sky у Грузії. Тут пояснюємо офіційний перехід до купівлі, аеропорт Натахтарі, багаж, погодні скасування і планування маршруту.',
  },
  ka: {
    title: 'Vanilla Sky-ის ბილეთების გზამკვლევები | GetFlights.ge',
    description: 'პრაქტიკული გზამკვლევები Vanilla Sky-ის ბილეთების ყიდვაზე საქართველოში, ნატახტრის აეროპორტზე, ბარგზე, ამინდით გაუქმებასა და დაგეგმვაზე.',
    h1: 'Vanilla Sky-ის ბილეთების გზამკვლევები',
    intro: 'წაიკითხეთ პრაქტიკული გზამკვლევები Vanilla Sky-ის შიდა ფრენების დაჯავშნამდე. აქ განვმარტავთ ოფიციალურ შეძენაზე გადასვლას, ნატახტრის აეროპორტს, ბარგს, ამინდით გაუქმებას და მარშრუტის დაგეგმვას.',
  },
};

export const blogSeoPosts: BlogSeoPost[] = locales.flatMap((locale) =>
  articleSlugs.map((slug) => ({
    locale,
    slug,
    path: `/${locale}/${slug}/`,
    publishedAt: BLOG_PUBLISHED_AT,
    updatedAt: BLOG_UPDATED_AT,
    ...articleCopies[slug][locale],
    source: slug === VANILLA_SKY_GUIDE_SLUG ? sourceCopy[locale] : undefined,
    routeLinks: routeLinks(locale),
  })),
);

export const blogSeoIndexPages: BlogSeoIndexPage[] = locales.map((locale) => ({
  locale,
  slug: 'blog',
  path: `/${locale}/blog/`,
  ...indexCopy[locale],
  posts: blogSeoPostsForLocale(locale),
}));

function article(
  title: string,
  description: string,
  h1: string,
  intro: string,
  cta: string,
  imageAlt: string,
  imageCaption: string,
  sections: BlogSeoSection[],
): BlogSeoPostContent {
  return {
    title,
    description,
    h1,
    intro,
    cta,
    image: {
      src: SEARCH_PREVIEW_IMAGE_PATH,
      alt: imageAlt,
      caption: imageCaption,
    },
    sections,
  };
}

function section(heading: string, body: string[]): BlogSeoSection {
  return { heading, body };
}

function normalizePath(pathname: string): `/${Locale}/${string}/` | string {
  const clean = `/${pathname.split('?')[0].split('#')[0].split('/').filter(Boolean).join('/')}/`;
  return clean === '//' ? '/' : clean;
}
