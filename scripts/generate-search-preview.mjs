import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'public/vanilla-sky-georgia-flight-preview.png');

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
        overflow: hidden;
        background: linear-gradient(180deg, #dff3ff 0%, #f7fbff 54%, #d9ebdf 100%);
      }

      .scene {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .sun {
        position: absolute;
        top: 58px;
        right: 128px;
        width: 126px;
        height: 126px;
        border-radius: 50%;
        background: #ffd56b;
        box-shadow: 0 0 70px rgba(255, 191, 73, 0.48);
      }

      .cloud {
        position: absolute;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.86);
        filter: blur(0.2px);
      }

      .cloud.one {
        top: 90px;
        left: 86px;
        width: 230px;
        height: 54px;
      }

      .cloud.two {
        top: 155px;
        right: 310px;
        width: 190px;
        height: 46px;
      }

      .mountain {
        position: absolute;
        left: -80px;
        right: -80px;
        bottom: 118px;
        height: 360px;
        clip-path: polygon(0 100%, 9% 58%, 18% 74%, 29% 36%, 40% 67%, 51% 28%, 62% 62%, 74% 38%, 84% 69%, 94% 45%, 100% 100%);
      }

      .mountain.back {
        bottom: 150px;
        height: 320px;
        background: linear-gradient(180deg, #95b7b6 0%, #5f8583 100%);
        opacity: 0.72;
      }

      .mountain.front {
        background: linear-gradient(180deg, #3e6d68 0%, #204b47 100%);
      }

      .snow {
        position: absolute;
        left: -80px;
        right: -80px;
        bottom: 303px;
        height: 175px;
        clip-path: polygon(9% 100%, 18% 66%, 23% 100%, 29% 25%, 35% 100%, 51% 0, 58% 100%, 74% 30%, 80% 100%, 94% 43%, 100% 100%);
        background: rgba(255, 255, 255, 0.75);
      }

      .valley {
        position: absolute;
        inset: auto -50px 0;
        height: 190px;
        background: linear-gradient(180deg, #8dbb87 0%, #3d8a72 100%);
      }

      .river {
        position: absolute;
        left: -40px;
        right: -40px;
        bottom: 0;
        height: 158px;
        clip-path: polygon(0 69%, 14% 52%, 28% 58%, 44% 36%, 60% 49%, 76% 30%, 100% 42%, 100% 100%, 0 100%);
        background: linear-gradient(180deg, #5eb8c1 0%, #16758a 100%);
        opacity: 0.92;
      }

      .plane {
        position: absolute;
        left: 360px;
        top: 220px;
        width: 430px;
        height: 150px;
        transform: rotate(-7deg);
        filter: drop-shadow(0 22px 26px rgba(13, 43, 56, 0.22));
      }

      .fuselage {
        position: absolute;
        left: 26px;
        top: 56px;
        width: 320px;
        height: 54px;
        border-radius: 44px 84px 84px 44px;
        background: linear-gradient(180deg, #ffffff 0%, #dfe8ee 100%);
        border: 3px solid #b5c4ce;
      }

      .nose {
        position: absolute;
        right: 34px;
        top: 62px;
        width: 74px;
        height: 42px;
        border-radius: 0 80px 80px 0;
        background: #d62535;
      }

      .window {
        position: absolute;
        top: 70px;
        width: 21px;
        height: 16px;
        border-radius: 9px;
        background: #274b63;
      }

      .window.w1 { left: 102px; }
      .window.w2 { left: 137px; }
      .window.w3 { left: 172px; }
      .window.w4 { left: 207px; }

      .wing {
        position: absolute;
        left: 158px;
        top: 88px;
        width: 184px;
        height: 54px;
        clip-path: polygon(0 0, 100% 18%, 78% 100%, 18% 78%);
        background: linear-gradient(180deg, #f9fbfc 0%, #b9c7cf 100%);
        border-radius: 14px;
      }

      .tail {
        position: absolute;
        left: 24px;
        top: 23px;
        width: 96px;
        height: 76px;
        clip-path: polygon(0 100%, 42% 0, 100% 100%);
        background: #d62535;
      }

      .prop {
        position: absolute;
        right: 0;
        top: 47px;
        width: 82px;
        height: 82px;
        border: 6px solid rgba(31, 60, 77, 0.25);
        border-radius: 50%;
      }

      .prop::before,
      .prop::after {
        content: "";
        position: absolute;
        left: 35px;
        top: 4px;
        width: 12px;
        height: 68px;
        border-radius: 999px;
        background: rgba(31, 60, 77, 0.38);
      }

      .prop::after {
        transform: rotate(90deg);
      }
    </style>
  </head>
  <body>
    <main class="scene" aria-label="Small aircraft flying over Georgian mountain routes">
      <div class="sun"></div>
      <div class="cloud one"></div>
      <div class="cloud two"></div>
      <div class="mountain back"></div>
      <div class="mountain front"></div>
      <div class="snow"></div>
      <div class="valley"></div>
      <div class="river"></div>
      <div class="plane" aria-hidden="true">
        <div class="tail"></div>
        <div class="wing"></div>
        <div class="fuselage"></div>
        <div class="nose"></div>
        <div class="window w1"></div>
        <div class="window w2"></div>
        <div class="window w3"></div>
        <div class="window w4"></div>
        <div class="prop"></div>
      </div>
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
