import { beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE_NOW = new Date('2026-07-16T10:00:00Z');

const fixtureSnapshot = {
  loadedAt: '2026-07-16T08:00:00Z',
  availability: {
    '7:4': { outbound: ['2026-07-18', '2026-07-21', '2026-07-25'], returns: [] },
  },
};

const routeHtml = [
  '<!doctype html><html><head><meta charset="utf-8" /></head><body>',
  '<div id="root"><main class="seo-static"><h1>Buy Tbilisi to Batumi flight tickets</h1></main></div>',
  '</body></html>',
].join('');

function createAssetResponse(body, contentType = 'text/html; charset=utf-8') {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      etag: '"asset-etag"',
      'last-modified': 'Wed, 15 Jul 2026 00:00:00 GMT',
    },
  });
}

async function loadChain() {
  vi.resetModules();
  const { onRequest } = await import('./_middleware.js');
  return onRequest;
}

function createChainRunner(handlers, { env = {}, fetchAsset } = {}) {
  const waitUntil = vi.fn();
  const run = (index, request) => {
    if (index >= handlers.length) return fetchAsset(request);
    return handlers[index]({
      request,
      env,
      waitUntil,
      next: (input) => run(index + 1, input instanceof Request ? input : request),
    });
  };
  return { run: (request) => run(0, request), waitUntil };
}

describe('Pages routing middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXTURE_NOW);
  });

  it('rejects protocol-relative backend proxy paths before static fallback', async () => {
    const onRequest = await loadChain();
    const fetchAsset = vi.fn(async () => new Response('static fallback'));
    const { run } = createChainRunner(onRequest, { fetchAsset });

    const response = await run(new Request('https://getflights.ge/vs-backend//example.com/probe?x=1'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid backend proxy path.',
    });
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it('passes non-schedule requests through to Pages routing untouched', async () => {
    const onRequest = await loadChain();
    const fetchAsset = vi.fn(async () => new Response('ok'));
    const { run } = createChainRunner(onRequest, { fetchAsset });

    const response = await run(new Request('https://getflights.ge/en/blog/'));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('ok');
    expect(fetchAsset).toHaveBeenCalledTimes(1);
  });

  it('injects live flight dates into route landing pages', async () => {
    const onRequest = await loadChain();
    const env = {
      VS_CACHE_SERVICE: {
        fetch: vi.fn(async () => Response.json(fixtureSnapshot)),
      },
    };
    const fetchAsset = vi.fn(async () => createAssetResponse(routeHtml));
    const { run } = createChainRunner(onRequest, { env, fetchAsset });

    const responsePromise = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    const response = await responsePromise;
    const html = await response.text();

    expect(env.VS_CACHE_SERVICE.fetch).toHaveBeenCalledTimes(1);
    expect(html).toContain('seo-live-schedule');
    expect(html).toContain('Upcoming Tbilisi → Batumi flight dates');
    expect(html.indexOf('seo-live-schedule')).toBeLessThan(html.indexOf('</main>'));
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('last-modified')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('strips conditional request headers so injected pages never 304', async () => {
    const onRequest = await loadChain();
    const env = {
      VS_CACHE_SERVICE: {
        fetch: vi.fn(async () => Response.json(fixtureSnapshot)),
      },
    };
    const fetchAsset = vi.fn(async () => createAssetResponse(routeHtml));
    const { run } = createChainRunner(onRequest, { env, fetchAsset });

    const responsePromise = run(
      new Request('https://getflights.ge/en/flights/tbilisi-batumi/', {
        headers: { 'if-none-match': '"asset-etag"', 'if-modified-since': 'Wed, 15 Jul 2026 00:00:00 GMT' },
      }),
    );
    await vi.runAllTimersAsync();
    await responsePromise;

    const forwarded = fetchAsset.mock.calls[0][0];
    expect(forwarded.headers.has('if-none-match')).toBe(false);
    expect(forwarded.headers.has('if-modified-since')).toBe(false);
  });

  it('serves the page unmodified when the availability service fails', async () => {
    const onRequest = await loadChain();
    const env = {
      VS_CACHE_SERVICE: {
        fetch: vi.fn(async () => {
          throw new Error('service down');
        }),
      },
    };
    const fetchAsset = vi.fn(async () => createAssetResponse(routeHtml));
    const { run } = createChainRunner(onRequest, { env, fetchAsset });

    const responsePromise = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(routeHtml);
    expect(response.headers.get('etag')).toBe('"asset-etag"');
  });

  it('serves the page unmodified when the service is not bound', async () => {
    const onRequest = await loadChain();
    const fetchAsset = vi.fn(async () => createAssetResponse(routeHtml));
    const { run } = createChainRunner(onRequest, { fetchAsset });

    const response = await run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));

    await expect(response.text()).resolves.toBe(routeHtml);
    expect(response.headers.get('etag')).toBe('"asset-etag"');
  });

  it('does not transform non-HTML responses on schedule paths', async () => {
    const onRequest = await loadChain();
    const env = {
      VS_CACHE_SERVICE: {
        fetch: vi.fn(async () => Response.json(fixtureSnapshot)),
      },
    };
    const fetchAsset = vi.fn(async () => createAssetResponse('{"ok":true}', 'application/json'));
    const { run } = createChainRunner(onRequest, { env, fetchAsset });

    const responsePromise = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    await expect(response.text()).resolves.toBe('{"ok":true}');
    expect(response.headers.get('etag')).toBe('"asset-etag"');
  });

  it('retries the availability snapshot after a failure instead of memoizing null', async () => {
    const onRequest = await loadChain();
    let calls = 0;
    const env = {
      VS_CACHE_SERVICE: {
        fetch: vi.fn(async () => {
          calls += 1;
          if (calls === 1) throw new Error('cold start');
          return Response.json(fixtureSnapshot);
        }),
      },
    };
    const fetchAsset = vi.fn(async () => createAssetResponse(routeHtml));
    const { run } = createChainRunner(onRequest, { env, fetchAsset });

    const first = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    await expect((await first).text()).resolves.toBe(routeHtml);

    const second = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    const html = await (await second).text();

    expect(env.VS_CACHE_SERVICE.fetch).toHaveBeenCalledTimes(2);
    expect(html).toContain('seo-live-schedule');
  });

  it('memoizes the availability snapshot across requests', async () => {
    const onRequest = await loadChain();
    const env = {
      VS_CACHE_SERVICE: {
        fetch: vi.fn(async () => Response.json(fixtureSnapshot)),
      },
    };
    const fetchAsset = vi.fn(async () => createAssetResponse(routeHtml));
    const { run } = createChainRunner(onRequest, { env, fetchAsset });

    const first = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    await first;
    const second = run(new Request('https://getflights.ge/en/flights/tbilisi-batumi/'));
    await vi.runAllTimersAsync();
    await second;

    expect(env.VS_CACHE_SERVICE.fetch).toHaveBeenCalledTimes(1);
  });
});
