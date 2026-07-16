const defaultFrom = { email: 'alerts@getflights.ge', name: 'GetFlights.ge' };

export class AlertEmailUnavailableError extends Error {
  constructor(message = 'Alert email provider is unavailable.') {
    super(message);
    this.name = 'AlertEmailUnavailableError';
  }
}

export function createAlertEmailer(env, options = {}) {
  const send = env?.EMAIL?.send;
  const from = options.from ?? defaultFrom;

  return {
    async sendConfirmation({ to, locale, routeLabel, confirmUrl }) {
      return sendAlertEmail(send, {
        to,
        from,
        subject: `Confirm your GetFlights.ge alert for ${routeLabel}`,
        text: [
          `Confirm your alert for ${routeLabel}.`,
          '',
          `Confirm link: ${confirmUrl}`,
        ].join('\n'),
        html: renderHtml({
          title: `Confirm your alert for ${routeLabel}`,
          lines: [
            escapeHtml(routeLabel),
            `<a href="${escapeAttr(confirmUrl)}">${escapeHtml(confirmUrl)}</a>`,
          ],
        }),
      });
    },

    async sendManageLink({ to, locale, manageUrl }) {
      return sendAlertEmail(send, {
        to,
        from,
        subject: 'Manage your GetFlights.ge alerts',
        text: [
          'Manage your GetFlights.ge alerts.',
          '',
          `Manage link: ${manageUrl}`,
        ].join('\n'),
        html: renderHtml({
          title: 'Manage your GetFlights.ge alerts',
          lines: [`<a href="${escapeAttr(manageUrl)}">${escapeHtml(manageUrl)}</a>`],
        }),
      });
    },

    async sendTicketAlert({ to, locale, routeLabel, dateFrom, dateTo, matchingDates, appUrl, manageUrl }) {
      const matchingList = Array.isArray(matchingDates) ? matchingDates.join(', ') : '';
      return sendAlertEmail(send, {
        to,
        from,
        subject: `Ticket alert for ${routeLabel}`,
        text: [
          `We found matching dates for ${routeLabel}.`,
          `Watched range: ${dateFrom} to ${dateTo}.`,
          `Matching dates: ${matchingList || 'none'}.`,
          '',
          `GetFlights link: ${appUrl}`,
          `Manage link: ${manageUrl}`,
        ].join('\n'),
        html: renderHtml({
          title: `Ticket alert for ${routeLabel}`,
          lines: [
            `Watched range: ${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)}`,
            `Matching dates: ${escapeHtml(matchingList || 'none')}`,
            `<a href="${escapeAttr(appUrl)}">${escapeHtml(appUrl)}</a>`,
            `<a href="${escapeAttr(manageUrl)}">${escapeHtml(manageUrl)}</a>`,
          ],
        }),
      });
    },
  };
}

async function sendAlertEmail(send, payload) {
  if (typeof send !== 'function') {
    throw new AlertEmailUnavailableError();
  }

  return send(payload);
}

function renderHtml({ title, lines }) {
  return [
    '<!doctype html>',
    '<html><body>',
    `<h1>${escapeHtml(title)}</h1>`,
    ...lines.map((line) => `<p>${line}</p>`),
    '</body></html>',
  ].join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}
