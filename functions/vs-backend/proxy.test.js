import { describe, expect, it, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Vanilla Sky Pages backend proxy', () => {
  it('proxies backend JSON requests to the official origin', async () => {
    const { onRequest } = await import('./[[path]].js');
    let upstreamRequest;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request) => {
        upstreamRequest = request;
        return Response.json(['7']);
      }),
    );

    const response = await onRequest({
      request: new Request('https://getflights.ge/vs-backend/custom/check-dest/4?lang=en', {
        headers: { Accept: 'application/json' },
      }),
      params: { path: ['custom', 'check-dest', '4'] },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(['7']);
    expect(upstreamRequest.url).toBe('https://ticket.vanillasky.ge/custom/check-dest/4?lang=en');
    expect(upstreamRequest.headers.get('accept')).toBe('application/json');
  });

  it('rewrites backend redirects and cookies for the Pages origin', async () => {
    const { onRequest } = await import('./[[path]].js');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: 'https://ticket.vanillasky.ge/en/tickets',
            'Set-Cookie': 'SESS=abc; Domain=ticket.vanillasky.ge; Path=/; HttpOnly',
          },
        }),
      ),
    );

    const response = await onRequest({
      request: new Request('https://getflights.ge/vs-backend/en/tickets'),
      params: { path: ['en', 'tickets'] },
    });

    expect(response.headers.get('location')).toBe('/vs-backend/en/tickets');
    expect(response.headers.getSetCookie()[0]).toBe('SESS=abc; Path=/; HttpOnly');
  });

  it('rejects protocol-relative proxy paths before fetching upstream', async () => {
    const { onRequest } = await import('./[[path]].js');
    const fetchMock = vi.fn(async () => Response.json({ proxied: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequest({
      request: new Request('https://getflights.ge/vs-backend//example.com/probe?x=1'),
      params: { path: ['example.com', 'probe'] },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid backend proxy path.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
