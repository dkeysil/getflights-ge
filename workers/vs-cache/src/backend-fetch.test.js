import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendSession, fetchBackendText } from './backend-fetch.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('backend fetch helpers', () => {
  it('follows successful POST redirects from the official search form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init = {}) => {
        if (init.redirect === 'manual') {
          return new Response(null, {
            status: 303,
            headers: { Location: 'https://ticket.vanillasky.ge/en/flights-form' },
          });
        }

        return new Response('<form id="form-select-flight"></form>');
      }),
    );

    await expect(fetchBackendText('/en/tickets', { method: 'POST' })).resolves.toBe(
      '<form id="form-select-flight"></form>',
    );
  });

  it('carries backend Set-Cookie values from form GET to search POST', async () => {
    const requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init = {}) => {
        requests.push(init);
        if (!init.method) {
          return new Response('<form></form>', {
            headers: { 'Set-Cookie': 'SSESSabc=session-value; Path=/; Secure; HttpOnly' },
          });
        }

        return new Response('<form id="form-select-flight"></form>');
      }),
    );

    const session = createBackendSession();
    await session.fetchText('/ru/tickets');
    await session.fetchText('/ru/tickets', { method: 'POST' });

    expect(requests[1].headers.Cookie).toBe('SSESSabc=session-value');
  });

  it('starts a backend session with caller cookies when provided', async () => {
    const requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init = {}) => {
        requests.push(init);
        return new Response('<form id="form-select-flight"></form>');
      }),
    );

    const session = createBackendSession('SSESSabc=caller-value; other=1');
    await session.fetchText('/ru/tickets', { method: 'POST' });

    expect(requests[0].headers.Cookie).toBe('SSESSabc=caller-value; other=1');
  });

  it('rejects backend paths that resolve away from the official origin', async () => {
    const fetchMock = vi.fn(async () => new Response('<form></form>'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBackendText('https://attacker.example/en/tickets')).rejects.toThrow(
      'Unsafe Vanilla Sky backend URL.',
    );
    await expect(fetchBackendText('//attacker.example/en/tickets')).rejects.toThrow(
      'Unsafe Vanilla Sky backend URL.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
