import { buildLiveScheduleHtml, resolveInjectionTarget } from './lib/live-schedule.js';

const BACKEND_PROXY_PREFIX = '/vs-backend';
const SNAPSHOT_MEMO_MS = 60_000;
const SNAPSHOT_DEADLINE_MS = 2_500;

function guardBackendProxyPath({ request, next }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith(`${BACKEND_PROXY_PREFIX}//`)) {
    return Response.json({ error: 'Invalid backend proxy path.' }, { status: 400 });
  }

  return next();
}

// Isolate-level cache of the shared availability snapshot promise. This is
// deliberate cross-request memoization of global data, not request state.
let snapshotMemo = null;

async function injectLiveSchedule(context) {
  const request = context.request;
  if (request.method !== 'GET') return context.next();

  const target = resolveInjectionTarget(new URL(request.url).pathname);
  if (!target) return context.next();

  // Conditional requests would 304 against the untransformed asset and let
  // clients keep serving stale injected dates, so force a full response.
  const [response, snapshot] = await Promise.all([
    context.next(stripConditionalHeaders(request)),
    loadSnapshot(context),
  ]);

  const contentType = response.headers.get('content-type') ?? '';
  if (!snapshot || response.status !== 200 || !contentType.includes('text/html')) {
    return response;
  }

  const section = buildLiveScheduleHtml(target, snapshot, new Date());
  if (!section) return response;

  const html = await response.text();
  const closeMain = '</main>';
  if (!html.includes(closeMain)) {
    // Content unchanged; rebuild the response because the body was consumed.
    return new Response(html, response);
  }

  const headers = new Headers(response.headers);
  headers.delete('etag');
  headers.delete('last-modified');
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=300');
  return new Response(html.replace(closeMain, `${section}${closeMain}`), {
    status: response.status,
    headers,
  });
}

function loadSnapshot(context) {
  const service = context.env?.VS_CACHE_SERVICE;
  if (!service?.fetch) return Promise.resolve(null);

  const now = Date.now();
  if (!snapshotMemo || snapshotMemo.expiresAt <= now) {
    const entry = { expiresAt: now + SNAPSHOT_MEMO_MS, promise: null };
    entry.promise = service
      .fetch('https://vs-cache.internal/api/availability')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((snapshot) => {
        // Never memoize a failure: the next request should retry immediately.
        if (snapshot === null && snapshotMemo === entry) snapshotMemo = null;
        return snapshot;
      });
    snapshotMemo = entry;
    // Let a slow first load finish and warm the memo even if this request's
    // deadline below gives up on it.
    context.waitUntil(entry.promise);
  }

  return withDeadline(snapshotMemo.promise, SNAPSHOT_DEADLINE_MS);
}

function withDeadline(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

function stripConditionalHeaders(request) {
  if (!request.headers.has('if-none-match') && !request.headers.has('if-modified-since')) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  return new Request(request, { headers });
}

export const onRequest = [guardBackendProxyPath, injectLiveSchedule];
