import { describe, expect, it } from 'vitest';
import { AlertEmailUnavailableError, createAlertEmailer } from './alerts-email.js';

function createProviderSpy() {
  const calls = [];
  return {
    calls,
    send(payload) {
      calls.push(payload);
      return Promise.resolve();
    },
  };
}

describe('alert email provider', () => {
  it('throws AlertEmailUnavailableError when no email provider exists', async () => {
    const emailer = createAlertEmailer({});

    await expect(
      emailer.sendConfirmation({
        to: 'user@example.com',
        locale: 'en',
        routeLabel: 'Tbilisi -> Batumi',
        confirmUrl: 'https://getflights.ge/en/alerts/confirm?token=abc',
      }),
    ).rejects.toBeInstanceOf(AlertEmailUnavailableError);
  });

  it('sends confirmation and manage-link emails with text and html bodies', async () => {
    const provider = createProviderSpy();
    const emailer = createAlertEmailer({ EMAIL: provider });

    await emailer.sendConfirmation({
      to: 'user@example.com',
      locale: 'en',
      routeLabel: 'Tbilisi -> Batumi',
      confirmUrl: 'https://getflights.ge/en/alerts/confirm?token=abc',
    });

    await emailer.sendManageLink({
      to: 'user@example.com',
      locale: 'en',
      manageUrl: 'https://getflights.ge/en/alerts/manage?token=def',
    });

    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]).toMatchObject({
      to: 'user@example.com',
      from: { email: 'alerts@getflights.ge', name: 'GetFlights.ge' },
      subject: expect.stringContaining('Tbilisi -> Batumi'),
      text: expect.stringContaining('https://getflights.ge/en/alerts/confirm?token=abc'),
      html: expect.stringContaining('https://getflights.ge/en/alerts/confirm?token=abc'),
    });
    expect(provider.calls[1]).toMatchObject({
      to: 'user@example.com',
      from: { email: 'alerts@getflights.ge', name: 'GetFlights.ge' },
      subject: expect.stringContaining('Manage'),
      text: expect.stringContaining('https://getflights.ge/en/alerts/manage?token=def'),
      html: expect.stringContaining('https://getflights.ge/en/alerts/manage?token=def'),
    });
  });

  it('includes the watched range, matching dates, GetFlights URL, and manage link in daily alert email', async () => {
    const provider = createProviderSpy();
    const emailer = createAlertEmailer({ EMAIL: provider });

    await emailer.sendTicketAlert({
      to: 'user@example.com',
      locale: 'en',
      routeLabel: 'Tbilisi -> Batumi',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      matchingDates: ['2026-08-01', '2026-08-15'],
      appUrl: 'https://getflights.ge/en/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31',
      manageUrl: 'https://getflights.ge/en/alerts/manage?token=def',
    });

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      to: 'user@example.com',
      from: { email: 'alerts@getflights.ge', name: 'GetFlights.ge' },
      text: expect.stringContaining('Tbilisi -> Batumi'),
    });
    expect(provider.calls[0].text).toContain('2026-08-01');
    expect(provider.calls[0].text).toContain('2026-08-15');
    expect(provider.calls[0].text).toContain('https://getflights.ge/en/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31');
    expect(provider.calls[0].text).toContain('https://getflights.ge/en/alerts/manage?token=def');
    expect(provider.calls[0].html).toContain('2026-08-01');
    expect(provider.calls[0].html).toContain('2026-08-15');
    expect(provider.calls[0].html).toContain('https://getflights.ge/en/?from=7&amp;to=4&amp;dateFrom=2026-08-01&amp;dateTo=2026-08-31');
    expect(provider.calls[0].html).toContain('https://getflights.ge/en/alerts/manage?token=def');
  });
});
