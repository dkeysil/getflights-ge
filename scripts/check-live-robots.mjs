const robotsUrl = process.env.ROBOTS_URL ?? 'https://getflights.ge/robots.txt';

const requiredAllowedAgents = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Bingbot',
  'Googlebot',
];

const expectedBlockedAgents = [
  'GPTBot',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
];

const response = await fetch(robotsUrl);
if (!response.ok) {
  throw new Error(`Could not fetch ${robotsUrl}: ${response.status} ${response.statusText}`);
}

const text = await response.text();
const failures = [];

if (/BEGIN Cloudflare Managed Content/i.test(text) || /BEGIN Cloudflare Managed content/i.test(text)) {
  failures.push('Cloudflare managed robots content is still prepended.');
}

for (const agent of requiredAllowedAgents) {
  if (hasRootDisallow(text, agent)) {
    failures.push(`${agent} is blocked with Disallow: /`);
  }
}

for (const agent of expectedBlockedAgents) {
  if (!hasRootDisallow(text, agent)) {
    failures.push(`${agent} is not explicitly blocked.`);
  }
}

if (!/Sitemap:\s*https:\/\/getflights\.ge\/sitemap\.xml/i.test(text)) {
  failures.push('Sitemap directive is missing.');
}

if (failures.length) {
  console.error(`Live robots policy check failed for ${robotsUrl}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Live robots policy check passed for ${robotsUrl}`);

function hasRootDisallow(source, agent) {
  const section = exactAgentSection(source, agent);
  if (!section) return false;
  return /^Disallow:\s*\/\s*$/im.test(section);
}

function exactAgentSection(source, agent) {
  const escaped = escapeRegExp(agent);
  const pattern = new RegExp(
    `(^|\\n)User-agent:\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\nUser-agent:\\s*|$)`,
    'i',
  );
  return pattern.exec(source)?.[2] ?? '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
