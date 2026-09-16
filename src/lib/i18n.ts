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
    alertsInviteTitle: 'Watch this route instead',
    alertsInviteBody: (route: string) =>
      `Seats on ${route} sell out and reopen. We can message you in Telegram when new ones appear.`,
    alertsRecoveryTitle: 'No seats on sale for this day',
    alertsRouteRecoveryTitle: 'No scheduled flights for this route',
    alertsRecoveryBody: (route: string) =>
      `Vanilla Sky keeps adding days as schedules firm up. Choose the dates you can travel and we will message you in Telegram as soon as ${route} is bookable.`,
    alertsRouteAria: (route: string) => `Telegram alerts for ${route}`,
    alertsWatchingRange: (range: string) => `Watching ${range}`,
    alertsOpenSetup: 'Set up an alert',
    alertsCloseSetup: 'Hide alert setup',
    alertsRangeLegend: 'Dates to watch',
    alertsRangePick: 'Pick dates in the calendar',
    alertsRangeCancel: 'Stop picking dates',
    alertsRangeReset: 'Clear dates',
    alertsRangeEmpty: 'Choose a date range',
    alertsRangeStartHint: 'Tap the first day to watch in the calendar above.',
    alertsRangeEndHint: (start: string) =>
      `Watching from ${start}. Now tap a later day to close the window — earlier days are not selectable.`,
    alertsRangeCalendarHint: 'Choose dates in the calendar above.',
    alertsNoteConfirm: 'Telegram asks you to confirm it is you — after that the alert is on.',
    alertsNoteTrigger: (route: string) => `We message you once ${route} has bookable seats inside those dates.`,
    alertsNoteStop: 'Send /stop in Telegram to end alerts any time.',
    alertsTelegramCta: 'Get alerts in Telegram',
    alertsTelegramOpening: 'Connecting Telegram...',
    alertsTelegramBound: (range: string) => `Alerts are on for ${range}. We message you in Telegram.`,
    alertsTelegramNeedsStart: 'Almost there — open the bot once and press Start so it may message you.',
    alertsTelegramOpenBot: 'Open the bot',
    alertsTelegramUnavailable: 'Telegram sign-in is not available in this environment.',
    alertsRangeIncomplete: 'Pick both dates to turn the alert on.',
    alertsTelegramError: 'Could not turn the alert on. Try again.',
    alertsEmailLabel: 'Email',
    alertsSubscribe: 'Notify me',
    alertsManage: 'Manage alerts',
    alertsAlreadyAvailable: 'Some of these dates are already on sale — the alert covers the rest.',
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
    alertsInviteTitle: 'Следить за этим маршрутом',
    alertsInviteBody: (route: string) =>
      `Места на маршруте ${route} раскупают и возвращают в продажу. Мы напишем в Telegram, когда появятся новые.`,
    alertsRecoveryTitle: 'На этот день мест в продаже нет',
    alertsRouteRecoveryTitle: 'На этом маршруте пока нет рейсов в расписании',
    alertsRecoveryBody: (route: string) =>
      `Vanilla Sky добавляет дни по мере утверждения расписания. Выберите даты, когда вам удобно лететь, и мы напишем в Telegram, как только ${route} можно будет забронировать.`,
    alertsRouteAria: (route: string) => `Уведомления в Telegram для маршрута ${route}`,
    alertsWatchingRange: (range: string) => `Следим за ${range}`,
    alertsOpenSetup: 'Настроить уведомление',
    alertsCloseSetup: 'Скрыть настройку',
    alertsRangeLegend: 'Даты для отслеживания',
    alertsRangePick: 'Выбрать даты в календаре',
    alertsRangeCancel: 'Остановить выбор дат',
    alertsRangeReset: 'Очистить даты',
    alertsRangeEmpty: 'Выберите диапазон дат',
    alertsRangeStartHint: 'Нажмите в календаре выше первый день для отслеживания.',
    alertsRangeEndHint: (start: string) =>
      `Следим с ${start}. Теперь нажмите более поздний день — более ранние выбрать нельзя.`,
    alertsRangeCalendarHint: 'Выберите даты в календаре выше.',
    alertsNoteConfirm: 'Telegram попросит подтвердить, что это вы — после этого уведомление включено.',
    alertsNoteTrigger: (route: string) =>
      `Мы напишем, как только на маршруте ${route} появятся места для брони в этих датах.`,
    alertsNoteStop: 'Команда /stop в Telegram отключит уведомления в любой момент.',
    alertsTelegramCta: 'Уведомления в Telegram',
    alertsTelegramOpening: 'Подключаем Telegram...',
    alertsTelegramBound: (range: string) => `Уведомления включены на ${range}. Напишем вам в Telegram.`,
    alertsTelegramNeedsStart: 'Почти готово — откройте бота и нажмите «Start», чтобы он мог вам написать.',
    alertsTelegramOpenBot: 'Открыть бота',
    alertsTelegramUnavailable: 'Вход через Telegram недоступен в этом окружении.',
    alertsRangeIncomplete: 'Выберите обе даты, чтобы включить уведомление.',
    alertsTelegramError: 'Не удалось включить уведомление. Попробуйте еще раз.',
    alertsEmailLabel: 'Email',
    alertsSubscribe: 'Сообщить мне',
    alertsManage: 'Управлять уведомлениями',
    alertsAlreadyAvailable: 'Часть этих дат уже в продаже — уведомление покроет остальные.',
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
    alertsInviteTitle: 'Стежити за цим маршрутом',
    alertsInviteBody: (route: string) =>
      `Місця на маршруті ${route} розкуповують і повертають у продаж. Ми напишемо в Telegram, коли зʼявляться нові.`,
    alertsRecoveryTitle: 'На цей день місць у продажу немає',
    alertsRouteRecoveryTitle: 'Для цього маршруту поки немає рейсів у розкладі',
    alertsRecoveryBody: (route: string) =>
      `Vanilla Sky додає дні, коли розклад стає остаточним. Виберіть дати, коли вам зручно летіти, і ми напишемо в Telegram, щойно ${route} можна буде забронювати.`,
    alertsRouteAria: (route: string) => `Сповіщення в Telegram для маршруту ${route}`,
    alertsWatchingRange: (range: string) => `Стежимо за ${range}`,
    alertsOpenSetup: 'Налаштувати сповіщення',
    alertsCloseSetup: 'Сховати налаштування',
    alertsRangeLegend: 'Дати для стеження',
    alertsRangePick: 'Вибрати дати в календарі',
    alertsRangeCancel: 'Зупинити вибір дат',
    alertsRangeReset: 'Очистити дати',
    alertsRangeEmpty: 'Виберіть діапазон дат',
    alertsRangeStartHint: 'Натисніть у календарі вище перший день для стеження.',
    alertsRangeEndHint: (start: string) =>
      `Стежимо з ${start}. Тепер натисніть пізніший день — ранішні обрати не можна.`,
    alertsRangeCalendarHint: 'Виберіть дати в календарі вище.',
    alertsNoteConfirm: 'Telegram попросить підтвердити, що це ви — після цього сповіщення увімкнено.',
    alertsNoteTrigger: (route: string) =>
      `Ми напишемо, щойно на маршруті ${route} зʼявляться місця для броні в цих датах.`,
    alertsNoteStop: 'Команда /stop у Telegram вимкне сповіщення будь-коли.',
    alertsTelegramCta: 'Сповіщення в Telegram',
    alertsTelegramOpening: 'Підключаємо Telegram...',
    alertsTelegramBound: (range: string) => `Сповіщення увімкнено на ${range}. Напишемо вам у Telegram.`,
    alertsTelegramNeedsStart: 'Майже готово — відкрийте бота й натисніть «Start», щоб він міг вам написати.',
    alertsTelegramOpenBot: 'Відкрити бота',
    alertsTelegramUnavailable: 'Вхід через Telegram недоступний у цьому середовищі.',
    alertsRangeIncomplete: 'Оберіть обидві дати, щоб увімкнути сповіщення.',
    alertsTelegramError: 'Не вдалося увімкнути сповіщення. Спробуйте ще раз.',
    alertsEmailLabel: 'Email',
    alertsSubscribe: 'Повідомити мене',
    alertsManage: 'Керувати сповіщеннями',
    alertsAlreadyAvailable: 'Частина цих дат уже в продажу — сповіщення покриє решту.',
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
    alertsInviteTitle: 'თვალი ადევნეთ ამ მარშრუტს',
    alertsInviteBody: (route: string) =>
      `მარშრუტზე ${route} ადგილები იყიდება და ისევ ჩნდება. ახლების გამოჩენისას Telegram-ში მოგწერთ.`,
    alertsRecoveryTitle: 'ამ დღეს ადგილები გაყიდვაში არ არის',
    alertsRouteRecoveryTitle: 'ამ მარშრუტისთვის ჯერ რეისები არ არის განრიგში',
    alertsRecoveryBody: (route: string) =>
      `Vanilla Sky ახალ დღეებს ამატებს განრიგის დაზუსტებისას. აირჩიეთ თქვენთვის მოსახერხებელი თარიღები და Telegram-ში მოგწერთ, როგორც კი ${route} დასაჯავშნი გახდება.`,
    alertsRouteAria: (route: string) => `Telegram-შეტყობინებები მარშრუტისთვის ${route}`,
    alertsWatchingRange: (range: string) => `ვადევნებთ თვალს: ${range}`,
    alertsOpenSetup: 'შეტყობინების გამართვა',
    alertsCloseSetup: 'გამართვის დამალვა',
    alertsRangeLegend: 'სათვალთვალო თარიღები',
    alertsRangePick: 'აირჩიეთ თარიღები კალენდარში',
    alertsRangeCancel: 'თარიღების არჩევის შეწყვეტა',
    alertsRangeReset: 'თარიღების გასუფთავება',
    alertsRangeEmpty: 'აირჩიეთ თარიღების დიაპაზონი',
    alertsRangeStartHint: 'ზემოთ კალენდარში აირჩიეთ პირველი სათვალთვალო დღე.',
    alertsRangeEndHint: (start: string) =>
      `ვადევნებთ თვალს ${start}-დან. ახლა აირჩიეთ უფრო გვიანი დღე — ადრინდელი დღეები არ აირჩევა.`,
    alertsRangeCalendarHint: 'აირჩიეთ თარიღები ზემოთ კალენდარში.',
    alertsNoteConfirm: 'Telegram გთხოვთ დაადასტუროთ ვინაობა — ამის შემდეგ შეტყობინება ჩართულია.',
    alertsNoteTrigger: (route: string) =>
      `მოგწერთ, როგორც კი მარშრუტზე ${route} ამ თარიღებში დასაჯავშნი ადგილები გაჩნდება.`,
    alertsNoteStop: 'Telegram-ში /stop ნებისმიერ დროს გამორთავს შეტყობინებებს.',
    alertsTelegramCta: 'შეტყობინებები Telegram-ში',
    alertsTelegramOpening: 'ვუკავშირდებით Telegram-ს...',
    alertsTelegramBound: (range: string) => `შეტყობინებები ჩართულია ${range}-ზე. მოგწერთ Telegram-ში.`,
    alertsTelegramNeedsStart: 'თითქმის მზადაა — გახსენით ბოტი და დააჭირეთ «Start», რომ მოგწეროთ.',
    alertsTelegramOpenBot: 'ბოტის გახსნა',
    alertsTelegramUnavailable: 'Telegram-ით შესვლა ამ გარემოში მიუწვდომელია.',
    alertsRangeIncomplete: 'აირჩიეთ ორივე თარიღი, რომ შეტყობინება ჩაირთოს.',
    alertsTelegramError: 'შეტყობინების ჩართვა ვერ მოხერხდა. სცადეთ ხელახლა.',
    alertsEmailLabel: 'ელფოსტა',
    alertsSubscribe: 'შემატყობინე',
    alertsManage: 'შეტყობინებების მართვა',
    alertsAlreadyAvailable: 'ამ თარიღების ნაწილი უკვე გაყიდვაშია — შეტყობინება დანარჩენს დაფარავს.',
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

// The copy bundle a component receives once the locale is resolved. Every locale
// carries the same keys, so this is the union of four identical shapes.
export type Messages = (typeof messages)[Locale];

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

// Day + month only: the alert range label is scanned, not read out loud, and the
// weekday that formatShortDate adds turns a two-date range into a wall of text.
export function formatCompactDate(iso: string, locale: Locale) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(toIntlLocale(locale), { day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}

export function formatDateRange(dateFrom: string, dateTo: string, locale: Locale) {
  if (!dateFrom || !dateTo) return '';
  if (dateFrom === dateTo) return formatCompactDate(dateFrom, locale);
  return `${formatCompactDate(dateFrom, locale)} – ${formatCompactDate(dateTo, locale)}`;
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
