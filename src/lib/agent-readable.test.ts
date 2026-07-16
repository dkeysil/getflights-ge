import { describe, expect, it } from 'vitest';
import {
  AGENT_READABLE_LAST_UPDATED,
  agentReadableFiles,
  buildBookingMarkdown,
  buildFlightsMarkdown,
  buildLlmsTxt,
} from './agent-readable';

describe('agent-readable files', () => {
  it('builds an llms.txt guide with canonical task and discovery links', () => {
    const text = buildLlmsTxt();

    expect(text).toContain('# GetFlights.ge');
    expect(text).toContain(`Last updated: ${AGENT_READABLE_LAST_UPDATED}`);
    expect(text).toContain('Canonical site: https://getflights.ge/');
    expect(text).toContain('- /flights.md - agent-readable route catalog and flight-search facts');
    expect(text).toContain('- /booking.md - booking handoff, fare, passenger, and official-site caveats');
    expect(text).toContain('- https://getflights.ge/en/flights/tbilisi-batumi/');
    expect(text).toContain('GetFlights.ge does not issue tickets or take payment.');
  });

  it('builds a route catalog that exposes public and official Vanilla Sky route facts', () => {
    const text = buildFlightsMarkdown();

    expect(text).toContain('# GetFlights.ge flight routes');
    expect(text).toContain(`Last updated: ${AGENT_READABLE_LAST_UPDATED}`);
    expect(text).toContain('Canonical human URL: https://getflights.ge/en/flights/');
    expect(text).toContain('| Tbilisi | Batumi | Tbilisi (Natakhtari airport) -> Batumi | https://getflights.ge/en/flights/tbilisi-batumi/ |');
    expect(text).toContain('| Kutaisi | Mestia | Kutaisi -> Mestia | https://getflights.ge/en/flights/kutaisi-mestia/ |');
    expect(text).toContain('Use the route URL above, then select a highlighted date in the app to fetch live fares.');
  });

  it('builds a booking guide that keeps live fares out of stale markdown', () => {
    const text = buildBookingMarkdown();

    expect(text).toContain('# GetFlights.ge booking handoff');
    expect(text).toContain(`Last updated: ${AGENT_READABLE_LAST_UPDATED}`);
    expect(text).toContain('Canonical human URL: https://getflights.ge/en/blog/how-to-buy-vanilla-sky-tickets/');
    expect(text).toContain('Fares are intentionally not published in this markdown file');
    expect(text).toContain('Maximum passenger count in the GetFlights.ge search UI: 4');
    expect(text).toContain('Payment and ticket issuance happen on the official Vanilla Sky website.');
  });

  it('does not use unofficial wording in generated public text files', () => {
    const text = agentReadableFiles.map((file) => file.content).join('\n');

    expect(text).not.toMatch(/\bunofficial\b/i);
    expect(text).not.toMatch(/\bunoficial\b/i);
  });

  it('exposes exactly the root files the SEO generator should write', () => {
    expect(agentReadableFiles.map((file) => file.path)).toEqual([
      'llms.txt',
      'flights.md',
      'booking.md',
    ]);

    for (const file of agentReadableFiles) {
      expect(file.content).toContain(`Last updated: ${AGENT_READABLE_LAST_UPDATED}`);
      expect(file.content.endsWith('\n')).toBe(true);
    }
  });
});
