const BACKEND_ORIGIN = 'https://ticket.vanillasky.ge';
const PROXY_PREFIX = '/vs-backend';
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

export async function onRequest({ request }) {
  let backendRequest;
  try {
    backendRequest = createBackendRequest(request);
  } catch (error) {
    if (error instanceof InvalidBackendProxyPathError) {
      return Response.json({ error: 'Invalid backend proxy path.' }, { status: 400 });
    }
    throw error;
  }

  const upstreamResponse = await fetch(backendRequest);
  return rewriteBackendResponse(upstreamResponse);
}

export function createBackendRequest(request) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(toBackendPath(sourceUrl), BACKEND_ORIGIN);
  if (targetUrl.origin !== BACKEND_ORIGIN) {
    throw new InvalidBackendProxyPathError();
  }

  const headers = new Headers(request.headers);
  const sourceOrigin = sourceUrl.origin;

  headers.delete('host');
  rewriteOriginHeader(headers, sourceOrigin);
  rewriteRefererHeader(headers, sourceOrigin);

  return new Request(targetUrl, {
    method: request.method,
    headers,
    body: BODYLESS_METHODS.has(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
}

export function rewriteBackendResponse(response) {
  const headers = new Headers(response.headers);
  const setCookies = getSetCookieHeaders(response.headers).map(rewriteSetCookie);

  rewriteLocationHeader(headers);
  headers.delete('set-cookie');
  setCookies.forEach((cookie) => headers.append('set-cookie', cookie));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function toBackendPath(sourceUrl) {
  const path = sourceUrl.pathname.slice(PROXY_PREFIX.length) || '/';
  const backendPath = path.startsWith('/') ? path : `/${path}`;
  if (backendPath.startsWith('//')) {
    throw new InvalidBackendProxyPathError();
  }

  return `${backendPath}${sourceUrl.search}`;
}

class InvalidBackendProxyPathError extends Error {}

function rewriteOriginHeader(headers, sourceOrigin) {
  if (headers.get('origin') === sourceOrigin) {
    headers.set('origin', BACKEND_ORIGIN);
  }
}

function rewriteRefererHeader(headers, sourceOrigin) {
  const referer = headers.get('referer');
  if (referer?.startsWith(sourceOrigin)) {
    headers.set('referer', referer.replace(sourceOrigin, BACKEND_ORIGIN));
  }
}

function rewriteLocationHeader(headers) {
  const location = headers.get('location');
  if (!location) return;

  const url = new URL(location, BACKEND_ORIGIN);
  if (url.origin === BACKEND_ORIGIN) {
    headers.set('location', `${PROXY_PREFIX}${url.pathname}${url.search}${url.hash}`);
  }
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? splitSetCookieHeader(setCookie) : [];
}

function rewriteSetCookie(cookie) {
  return cookie.replace(/;\s*Domain=[^;]*/gi, '');
}

function splitSetCookieHeader(header) {
  const cookies = [];
  let start = 0;
  let inExpires = false;

  for (let index = 0; index < header.length; index += 1) {
    const char = header[index];
    const segment = header.slice(Math.max(0, index - 8), index + 1).toLowerCase();

    if (segment.endsWith('expires=')) {
      inExpires = true;
    } else if (inExpires && char === ';') {
      inExpires = false;
    } else if (!inExpires && char === ',') {
      cookies.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  cookies.push(header.slice(start).trim());
  return cookies.filter(Boolean);
}
