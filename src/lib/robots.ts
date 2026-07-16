export const AI_CITATION_USER_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Bingbot',
  'Googlebot',
] as const;

export const BLOCKED_TRAINING_USER_AGENTS = [
  'GPTBot',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
] as const;

const SITE_ORIGIN = 'https://getflights.ge';

export function buildRobotsTxt() {
  return [
    ...AI_CITATION_USER_AGENTS.flatMap((agent) => [
      `User-agent: ${agent}`,
      'Allow: /',
      '',
    ]),
    ...BLOCKED_TRAINING_USER_AGENTS.flatMap((agent) => [
      `User-agent: ${agent}`,
      'Disallow: /',
      '',
    ]),
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');
}
