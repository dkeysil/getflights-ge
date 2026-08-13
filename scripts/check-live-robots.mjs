const robotsUrl = process.env.ROBOTS_URL ?? 'https://getflights.ge/robots.txt';

const requiredAllowedAgents = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'PerplexityBot',
  'ClaudeBot',
  'Claude-User',
  'Googlebot',
  'Google-Extended',
  'Bingbot',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot',
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

if (/^Disallow:\s*\/\s*$/im.test(text)) {
  failures.push('robots.txt still contains a root Disallow directive.');
}

if (!/Content-Signal:\s*search=yes,ai-input=yes,ai-train=yes,use=full/i.test(text)) {
  failures.push('Permissive Content-Signal directive is missing.');
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
  const sections = exactAgentSections(source, agent);
  return sections.some((section) => /^Disallow:\s*\/\s*$/im.test(section));
}

function exactAgentSections(source, agent) {
  const escaped = escapeRegExp(agent);
  const pattern = new RegExp(
    `(^|\\n)User-agent:\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\nUser-agent:\\s*|$)`,
    'gi',
  );
  return [...source.matchAll(pattern)].map((match) => match[2] ?? '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
