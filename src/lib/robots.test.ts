import { describe, expect, it } from 'vitest';
import { LLM_SEO_USER_AGENTS, buildRobotsTxt } from './robots';

describe('robots policy', () => {
  it('allows search engines and LLM crawlers for maximum LLM SEO visibility', () => {
    const robots = buildRobotsTxt();

    expect(robots).toContain('User-agent: *\nContent-Signal: search=yes,ai-input=yes,ai-train=yes,use=full\nAllow: /');

    for (const agent of LLM_SEO_USER_AGENTS) {
      expect(robots).toContain(`User-agent: ${agent}\nAllow: /`);
      expect(robots).not.toContain(`User-agent: ${agent}\nDisallow: /`);
    }

    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/im);
    expect(robots).toContain('Sitemap: https://getflights.ge/sitemap.xml');
    expect(robots.endsWith('\n')).toBe(true);
  });
});
