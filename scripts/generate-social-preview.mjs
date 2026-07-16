import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'public/social-preview.png');

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        width: 1200px;
        height: 630px;
        font-family: "Helvetica Neue", Arial, sans-serif;
        color: #14202b;
        background:
          radial-gradient(circle at 10% 8%, rgba(14, 124, 123, 0.17), transparent 28%),
          radial-gradient(circle at 92% 14%, rgba(200, 16, 46, 0.13), transparent 26%),
          linear-gradient(135deg, #f8fbfc 0%, #edf4f4 100%);
      }

      .frame {
        position: relative;
        width: 100%;
        height: 100%;
        padding: 64px 72px;
        overflow: hidden;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 16px;
        font-size: 32px;
        font-weight: 800;
        letter-spacing: 0;
      }

      .mark {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 18px;
        background: #c8102e;
        color: #fff;
        box-shadow: 0 16px 34px rgba(200, 16, 46, 0.26);
      }

      .headline {
        width: 690px;
        margin: 58px 0 0;
        font-size: 76px;
        line-height: 0.96;
        font-weight: 840;
        letter-spacing: 0;
      }

      .subhead {
        width: 660px;
        margin: 28px 0 0;
        color: #40515e;
        font-size: 30px;
        line-height: 1.26;
        font-weight: 500;
      }

      .pills {
        display: flex;
        gap: 12px;
        margin-top: 42px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        height: 46px;
        padding: 0 18px;
        border: 1px solid rgba(14, 124, 123, 0.18);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.78);
        color: #075c5b;
        font-size: 21px;
        font-weight: 760;
      }

      .panel {
        position: absolute;
        right: 72px;
        top: 116px;
        width: 352px;
        padding: 24px;
        border: 1px solid #dce7eb;
        border-radius: 30px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: 0 26px 60px rgba(20, 32, 43, 0.13);
      }

      .panel-label {
        color: #6a7782;
        font-size: 18px;
        font-weight: 760;
        text-transform: uppercase;
      }

      .route {
        margin-top: 18px;
        padding: 18px 18px 16px;
        border-radius: 20px;
        background: #f1f7f7;
      }

      .route strong {
        display: block;
        font-size: 26px;
        line-height: 1.15;
      }

      .route span {
        display: block;
        margin-top: 10px;
        color: #53636f;
        font-size: 18px;
        font-weight: 640;
      }

      .cta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 58px;
        margin-top: 18px;
        padding: 0 19px;
        border-radius: 18px;
        background: #0e7c7b;
        color: #fff;
        font-size: 22px;
        font-weight: 820;
      }

      .accent {
        position: absolute;
        right: -70px;
        bottom: -96px;
        width: 330px;
        height: 330px;
        border: 38px solid rgba(200, 16, 46, 0.12);
        border-radius: 50%;
      }
    </style>
  </head>
  <body>
    <main class="frame">
      <div class="brand">
        <div class="mark">GF</div>
        <div>GetFlights.ge</div>
      </div>
      <h1 class="headline">Find Vanilla Sky flight days fast.</h1>
      <p class="subhead">
        Live routes, real flying days, clear fares, and handoff to the official booking site.
      </p>
      <div class="pills">
        <div class="pill">Live schedule</div>
        <div class="pill">Route calendar</div>
        <div class="pill">Official checkout</div>
      </div>

      <section class="panel" aria-label="Preview route card">
        <div class="panel-label">Flying now</div>
        <div class="route">
          <strong>Mestia to Natakhtari</strong>
          <span>Pick a real flight day</span>
        </div>
        <div class="route">
          <strong>Batumi to Natakhtari</strong>
          <span>See dates before booking</span>
        </div>
        <div class="cta">
          <span>Book on Vanilla Sky</span>
          <span>-></span>
        </div>
      </section>
      <div class="accent"></div>
    </main>
  </body>
</html>`;

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outputPath, type: 'png' });
} finally {
  await browser.close();
}

console.log(`Generated ${outputPath}`);
