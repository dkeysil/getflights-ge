const BACKEND_ORIGIN = 'https://ticket.vanillasky.ge';

export async function fetchBackendJson(path) {
  const response = await fetchBackend(path, {
    headers: { Accept: 'application/json' },
  });
  return response.json();
}

export async function fetchBackendText(path, init = {}) {
  const response = await fetchBackend(path, init);
  return response.text();
}

export function createBackendSession(initialCookieHeader = '') {
  const cookies = parseCookieHeader(initialCookieHeader);

  return {
    async fetchText(path, init = {}) {
      const headers = { ...init.headers };
      if (cookies.size > 0 && !headers.Cookie) {
        headers.Cookie = [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
      }

      const response = await fetchBackend(path, { ...init, headers });
      storeCookies(cookies, response.headers);
      return response.text();
    },
  };
}

function parseCookieHeader(header) {
  const cookies = new Map();

  for (const cookie of header.split(';')) {
    const pair = cookie.trim();
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }

  return cookies;
}

async function fetchBackend(path, init = {}) {
  const response = await fetch(toBackendUrl(path), {
    ...init,
    redirect: init.redirect ?? 'follow',
  });

  if (!response.ok) {
    throw new Error(`Vanilla Sky backend request failed: ${response.status} ${path}`);
  }

  return response;
}

function toBackendUrl(path) {
  const url = new URL(path, BACKEND_ORIGIN);
  if (url.origin !== BACKEND_ORIGIN) {
    throw new Error('Unsafe Vanilla Sky backend URL.');
  }

  return url;
}

function storeCookies(cookies, headers) {
  const values =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : splitSetCookieHeader(headers.get('set-cookie'));

  for (const cookie of values) {
    const [pair] = cookie.split(';');
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function splitSetCookieHeader(header) {
  if (!header) return [];

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
