// Bot copy for the four app locales. Messages are sent with parse_mode=HTML,
// so every interpolated value goes through escapeHtml first.
const copy = {
  en: {
    subscribed: 'Alerts are on.',
    watching: 'Watching',
    range: 'Dates',
    alertTitle: 'Tickets are available!',
    matching: 'Available dates',
    openSearch: 'Open in GetFlights',
    stopHint: 'Send /stop to turn alerts off.',
    listHint: 'Send /list to see your alerts.',
    stopped: (count) => `Alerts off. Unsubscribed ${count} alert${count === 1 ? '' : 's'}.`,
    nothingToStop: 'You have no active alerts.',
    listTitle: 'Your alerts',
    listEmpty: 'You have no active alerts.',
    help: 'I notify you when Vanilla Sky tickets appear on a route you picked.',
    invalidToken: 'That link expired or was already used. Start a new alert on GetFlights.ge:',
  },
  ru: {
    subscribed: 'Уведомления включены.',
    watching: 'Отслеживаем',
    range: 'Даты',
    alertTitle: 'Билеты появились!',
    matching: 'Доступные даты',
    openSearch: 'Открыть в GetFlights',
    stopHint: 'Отправьте /stop, чтобы отключить уведомления.',
    listHint: 'Отправьте /list, чтобы посмотреть свои уведомления.',
    stopped: (count) => `Уведомления отключены. Отписано: ${count}.`,
    nothingToStop: 'У вас нет активных уведомлений.',
    listTitle: 'Ваши уведомления',
    listEmpty: 'У вас нет активных уведомлений.',
    help: 'Я сообщу, когда на выбранном маршруте появятся билеты Vanilla Sky.',
    invalidToken: 'Ссылка устарела или уже использована. Создайте новое уведомление на GetFlights.ge:',
  },
  ua: {
    subscribed: 'Сповіщення увімкнено.',
    watching: 'Відстежуємо',
    range: 'Дати',
    alertTitle: 'Квитки зʼявилися!',
    matching: 'Доступні дати',
    openSearch: 'Відкрити в GetFlights',
    stopHint: 'Надішліть /stop, щоб вимкнути сповіщення.',
    listHint: 'Надішліть /list, щоб побачити свої сповіщення.',
    stopped: (count) => `Сповіщення вимкнено. Відписано: ${count}.`,
    nothingToStop: 'У вас немає активних сповіщень.',
    listTitle: 'Ваші сповіщення',
    listEmpty: 'У вас немає активних сповіщень.',
    help: 'Я повідомлю, коли на обраному маршруті зʼявляться квитки Vanilla Sky.',
    invalidToken: 'Посилання застаріло або вже використане. Створіть нове сповіщення на GetFlights.ge:',
  },
  ka: {
    subscribed: 'შეტყობინებები ჩართულია.',
    watching: 'ვაკვირდებით',
    range: 'თარიღები',
    alertTitle: 'ბილეთები გამოჩნდა!',
    matching: 'ხელმისაწვდომი თარიღები',
    openSearch: 'გახსენი GetFlights-ში',
    stopHint: 'გამორთვისთვის გამოგზავნეთ /stop.',
    listHint: 'თქვენი შეტყობინებების სანახავად გამოგზავნეთ /list.',
    stopped: (count) => `შეტყობინებები გამორთულია. გაუქმდა: ${count}.`,
    nothingToStop: 'აქტიური შეტყობინებები არ გაქვთ.',
    listTitle: 'თქვენი შეტყობინებები',
    listEmpty: 'აქტიური შეტყობინებები არ გაქვთ.',
    help: 'შეგატყობინებთ, როცა არჩეულ მარშრუტზე Vanilla Sky-ის ბილეთები გამოჩნდება.',
    invalidToken: 'ბმული ვადაგასულია ან უკვე გამოყენებულია. შექმენით ახალი შეტყობინება GetFlights.ge-ზე:',
  },
};

export const telegramMessageLocales = Object.keys(copy);

export function renderTelegramSubscribedMessage({ locale, routeLabel, dateFrom, dateTo, searchUrl }) {
  const text = localeCopy(locale);
  return joinLines([
    `<b>${escapeHtml(text.subscribed)}</b>`,
    `${escapeHtml(text.watching)}: ${escapeHtml(routeLabel)}`,
    `${escapeHtml(text.range)}: ${escapeHtml(dateFrom)} — ${escapeHtml(dateTo)}`,
    escapeHtml(searchUrl),
    escapeHtml(text.stopHint),
  ]);
}

export function renderTelegramAlertMessage({ locale, routeLabel, dateFrom, dateTo, matchingDates, searchUrl }) {
  const text = localeCopy(locale);
  return joinLines([
    `<b>${escapeHtml(text.alertTitle)}</b>`,
    `${escapeHtml(text.watching)}: ${escapeHtml(routeLabel)}`,
    `${escapeHtml(text.range)}: ${escapeHtml(dateFrom)} — ${escapeHtml(dateTo)}`,
    `${escapeHtml(text.matching)}: ${escapeHtml(formatDates(matchingDates))}`,
    `<a href="${escapeHtml(searchUrl)}">${escapeHtml(text.openSearch)}</a>`,
    escapeHtml(text.stopHint),
  ]);
}

export function renderTelegramStopMessage({ locale, count }) {
  const text = localeCopy(locale);
  return escapeHtml(count > 0 ? text.stopped(count) : text.nothingToStop);
}

export function renderTelegramListMessage({ locale, subscriptions }) {
  const text = localeCopy(locale);
  if (!subscriptions.length) return escapeHtml(text.listEmpty);

  return joinLines([
    `<b>${escapeHtml(text.listTitle)}</b>`,
    ...subscriptions.map(
      (subscription) =>
        `• ${escapeHtml(subscription.routeLabel)}: ${escapeHtml(subscription.dateFrom)} — ${escapeHtml(subscription.dateTo)}`,
    ),
    escapeHtml(text.stopHint),
  ]);
}

export function renderTelegramHelpMessage({ locale }) {
  const text = localeCopy(locale);
  return joinLines([escapeHtml(text.help), escapeHtml(text.listHint), escapeHtml(text.stopHint)]);
}

export function renderTelegramInvalidTokenMessage({ locale, siteUrl }) {
  const text = localeCopy(locale);
  return joinLines([escapeHtml(text.invalidToken), escapeHtml(siteUrl)]);
}

function localeCopy(locale) {
  return copy[locale] ?? copy.en;
}

function formatDates(matchingDates) {
  return Array.isArray(matchingDates) ? matchingDates.join(', ') : '';
}

function joinLines(lines) {
  return lines.filter(Boolean).join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
