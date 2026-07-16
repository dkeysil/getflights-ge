import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function loadIndexDocument() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

function metaContent(document, selector) {
  return document.querySelector(selector)?.getAttribute('content');
}

describe('social preview metadata', () => {
  it('defines Open Graph and Twitter cards for getflights.ge', () => {
    const document = loadIndexDocument();

    expect(document.querySelector('title')?.textContent).toBe(
      'Vanilla Sky tickets and flights in Georgia - GetFlights.ge',
    );
    expect(metaContent(document, 'meta[name="description"]')).toBe(
      'See every Vanilla Sky flight date in Georgia at a glance: live Vanilla Sky tickets for Tbilisi, Batumi, Mestia, Ambrolauri, and Kutaisi routes, with official booking.',
    );
    expect(metaContent(document, 'meta[property="og:title"]')).toBe(
      'Vanilla Sky tickets and flights in Georgia - GetFlights.ge',
    );
    expect(metaContent(document, 'meta[property="og:description"]')).toBe(
      'Live Vanilla Sky ticket days, clearer routes, and official booking handoff for flights in Georgia.',
    );
    expect(metaContent(document, 'meta[property="og:url"]')).toBe('https://getflights.ge/');
    expect(metaContent(document, 'meta[property="og:image"]')).toBe(
      'https://getflights.ge/vanilla-sky-georgia-flight-preview.png',
    );
    expect(metaContent(document, 'meta[property="og:image:width"]')).toBe('1200');
    expect(metaContent(document, 'meta[property="og:image:height"]')).toBe('630');
    expect(metaContent(document, 'meta[property="og:image:alt"]')).toBe(
      "Small aircraft flying over Georgia's mountain routes.",
    );
    expect(metaContent(document, 'meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(metaContent(document, 'meta[name="twitter:image"]')).toBe(
      'https://getflights.ge/vanilla-sky-georgia-flight-preview.png',
    );
    expect(metaContent(document, 'meta[name="application-name"]')).toBe('GetFlights.ge');
    expect(metaContent(document, 'meta[name="robots"]')).toBe('max-image-preview:large');
  });

  it('ships a 1200 by 630 PNG search preview image', () => {
    const imageUrl = join(ROOT, 'public/vanilla-sky-georgia-flight-preview.png');

    expect(existsSync(imageUrl)).toBe(true);

    const png = readFileSync(imageUrl);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('defines and ships favicon assets for browsers and install surfaces', () => {
    const document = loadIndexDocument();

    expect(
      document.querySelector('link[rel="icon"][sizes="192x192"]')?.getAttribute('href'),
    ).toBe('https://getflights.ge/android-chrome-192x192.png');
    expect(
      document.querySelector('link[rel="icon"][sizes="48x48"]')?.getAttribute('href'),
    ).toBe('https://getflights.ge/favicon-48x48.png');
    expect(document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href')).toBe(
      '/favicon.svg',
    );
    expect(document.querySelector('link[rel="icon"][sizes="32x32"]')?.getAttribute('href')).toBe(
      '/favicon-32x32.png',
    );
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe(
      '/apple-touch-icon.png',
    );
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe(
      '/site.webmanifest',
    );

    const favicon48 = readFileSync(join(ROOT, 'public/favicon-48x48.png'));
    expect(favicon48.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(favicon48.readUInt32BE(16)).toBe(48);
    expect(favicon48.readUInt32BE(20)).toBe(48);

    const favicon32 = readFileSync(join(ROOT, 'public/favicon-32x32.png'));
    expect(favicon32.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(favicon32.readUInt32BE(16)).toBe(32);
    expect(favicon32.readUInt32BE(20)).toBe(32);

    const appleTouchIcon = readFileSync(join(ROOT, 'public/apple-touch-icon.png'));
    expect(appleTouchIcon.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(appleTouchIcon.readUInt32BE(16)).toBe(180);
    expect(appleTouchIcon.readUInt32BE(20)).toBe(180);

    const manifest = JSON.parse(readFileSync(join(ROOT, 'public/site.webmanifest'), 'utf8'));
    expect(manifest.name).toBe('GetFlights.ge');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        }),
      ]),
    );
  });

  it('installs the direct GA4 Google tag in the document head', () => {
    const document = loadIndexDocument();
    const googleTagScript = document.querySelector(
      'head script[async][src="https://www.googletagmanager.com/gtag/js?id=G-306ZQXLQH6"]',
    );
    const inlineScript = Array.from(document.querySelectorAll('head script')).find((script) =>
      script.textContent.includes("gtag('config', 'G-306ZQXLQH6')"),
    );

    expect(googleTagScript).toBeTruthy();
    expect(inlineScript?.textContent).toContain('window.dataLayer = window.dataLayer || []');
    expect(inlineScript?.textContent).toContain('function gtag(){dataLayer.push(arguments);}');
    expect(inlineScript?.textContent).toContain("gtag('js', new Date());");
  });

  it('publishes HTTPS-only headers for crawlers and browsers', () => {
    const headers = readFileSync(join(ROOT, 'public/_headers'), 'utf8');

    expect(headers).toContain('/*');
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains');
  });
});
