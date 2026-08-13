export const LLM_SEO_USER_AGENTS = [
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
] as const;

const SITE_ORIGIN = 'https://getflights.ge';

export function buildRobotsTxt() {
  return [
    '# GetFlights.ge is intentionally open to search engines, AI answer engines, and LLM crawlers.',
    '# Content Signals: search=yes allows indexing, ai-input=yes allows retrieval/grounding,',
    '# ai-train=yes allows model training, and use=full allows generated answers to use the content.',
    'User-agent: *',
    'Content-Signal: search=yes,ai-input=yes,ai-train=yes,use=full',
    'Allow: /',
    '',
    ...LLM_SEO_USER_AGENTS.flatMap((agent) => [
      `User-agent: ${agent}`,
      'Allow: /',
      '',
    ]),
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');
}
