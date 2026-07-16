import { describe, expect, it } from 'vitest';
import {
  AI_CITATION_USER_AGENTS,
  BLOCKED_TRAINING_USER_AGENTS,
  buildRobotsTxt,
} from './robots';

describe('robots policy', () => {
  it('allows AI search and citation crawlers while blocking training-only crawlers', () => {
    const robots = buildRobotsTxt();

    for (const agent of AI_CITATION_USER_AGENTS) {
      expect(robots).toContain(`User-agent: ${agent}\nAllow: /`);
      expect(robots).not.toContain(`User-agent: ${agent}\nDisallow: /`);
    }

    for (const agent of BLOCKED_TRAINING_USER_AGENTS) {
      expect(robots).toContain(`User-agent: ${agent}\nDisallow: /`);
    }

    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots).toContain('Sitemap: https://getflights.ge/sitemap.xml');
    expect(robots.endsWith('\n')).toBe(true);
  });
});
