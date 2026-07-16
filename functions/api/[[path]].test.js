import { describe, expect, it, vi } from 'vitest';

describe('cached API Pages forwarder', () => {
  it('forwards API requests to the bound cache service worker', async () => {
    const { onRequest } = await import('./[[path]].js');
    const fetch = vi.fn(async (request) =>
      Response.json({
        forwardedUrl: request.url,
        forwardedMethod: request.method,
      }),
    );

    const response = await onRequest({
      request: new Request('https://getflights.ge/api/availability/refresh', { method: 'POST' }),
      env: {
        VS_CACHE_SERVICE: { fetch },
      },
    });

    await expect(response.json()).resolves.toEqual({
      forwardedUrl: 'https://getflights.ge/api/availability/refresh',
      forwardedMethod: 'POST',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns a clear error when the cache service binding is missing', async () => {
    const { onRequest } = await import('./[[path]].js');

    const response = await onRequest({
      request: new Request('https://getflights.ge/api/availability'),
      env: {},
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Cache service is not configured.',
    });
  });
});
