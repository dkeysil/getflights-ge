import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const publicDir = join(root, 'public');
const failures = [];

await checkJson('api-catalog.json', (catalog) => {
  requireField(catalog.openapi === 'https://getflights.ge/openapi.json', 'api-catalog.json points to /openapi.json');
  requireField(catalog.auth === 'https://getflights.ge/auth.md', 'api-catalog.json points to /auth.md');
  requireField(Array.isArray(catalog.services) && catalog.services.length >= 2, 'api-catalog.json lists web services');
});

await checkJson('.well-known/api-catalog.json', (catalog) => {
  requireField(catalog.canonical === 'https://getflights.ge/api-catalog.json', '.well-known/api-catalog.json keeps canonical URL');
});

await checkJson('openapi.json', (openapi) => {
  requireField(openapi.openapi?.startsWith('3.'), 'openapi.json declares OpenAPI 3.x');
  requireField(Boolean(openapi.paths?.['/api/availability']?.get), 'openapi.json documents GET /api/availability');
  requireField(Boolean(openapi.paths?.['/api/flights']?.get), 'openapi.json documents GET /api/flights');
  requireField(Boolean(openapi.paths?.['/api/alerts/subscribe']?.post), 'openapi.json documents alert subscription API');
});

await checkMirror('openapi.json', '.well-known/openapi.json');

await checkText('auth.md', (auth) => {
  requireField(auth.includes('No authentication is required'), 'auth.md states public no-auth access');
  requireField(auth.includes('/api/availability'), 'auth.md lists public API access');
  requireField(auth.includes('magic links'), 'auth.md explains alert magic links');
});

await checkMirror('auth.md', '.well-known/auth.md');

await checkText('_headers', (headers) => {
  requireField(headers.includes('rel="service-desc"'), '_headers exposes service-desc Link headers');
  requireField(headers.includes('</api-catalog.json>'), '_headers links API catalog');
  requireField(headers.includes('</openapi.json>'), '_headers links OpenAPI');
  requireField(headers.includes('</auth.md>'), '_headers links Auth.md');
  requireField(headers.includes('Content-Type: application/openapi+json; charset=utf-8'), '_headers sets OpenAPI content type');
  requireField(headers.includes('Content-Type: text/markdown; charset=utf-8'), '_headers sets markdown content type');
});

await checkText('llms.txt', (llms) => {
  requireField(llms.includes('/api-catalog.json'), 'llms.txt links API catalog');
  requireField(llms.includes('/openapi.json'), 'llms.txt links OpenAPI');
  requireField(llms.includes('/auth.md'), 'llms.txt links Auth.md');
});

if (failures.length) {
  console.error('Agent diagnostics Level 2 check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Agent diagnostics Level 2 check passed');

async function checkJson(relativePath, inspect) {
  try {
    const value = JSON.parse(await readFile(join(publicDir, relativePath), 'utf8'));
    inspect(value);
  } catch (error) {
    failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkText(relativePath, inspect) {
  try {
    inspect(await readFile(join(publicDir, relativePath), 'utf8'));
  } catch (error) {
    failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkMirror(canonicalPath, mirrorPath) {
  try {
    const [canonical, mirror] = await Promise.all([
      readFile(join(publicDir, canonicalPath), 'utf8'),
      readFile(join(publicDir, mirrorPath), 'utf8'),
    ]);
    requireField(canonical === mirror, `${mirrorPath} matches ${canonicalPath}`);
  } catch (error) {
    failures.push(`${mirrorPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireField(condition, message) {
  if (!condition) failures.push(message);
}
