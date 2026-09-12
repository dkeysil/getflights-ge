// The alert range's colour and the shared content width are contracts the
// stylesheet has to keep. The Playwright layout suite cannot run in every
// environment, so these are asserted against the stylesheet source instead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Plain JS, like the other stylesheet/document contract test here, so reading a
// source file needs no Node type packages in the app's TypeScript build.
// Comments are stripped first so a rule's captured selector is only its
// selector, never the note that happens to sit above it.
const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Returns the declaration body of a rule whose selector list contains exactly
// this selector, so `.day.in-range` does not match `.day.in-range.avail`.
function ruleBody(selector) {
  const bodies = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(css))) {
    const selectors = match[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  return bodies.join('\n');
}

function declaredValue(token) {
  return new RegExp(`${token}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? null;
}

function relativeLuminance(hex) {
  const channel = (value) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(left, right) {
  const [lighter, darker] = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('alert range colour semantics', () => {
  const availability = ['--sky', '--sky-ink', '--sky-tint'];
  const alertTokens = ['--alert', '--alert-ink', '--alert-tint', '--alert-line'];

  it('keeps availability on its own green/teal token and the alert range off it', () => {
    // Flight availability is unchanged.
    expect(ruleBody('.day.avail')).toContain('var(--sky-tint)');
    expect(ruleBody('.day.avail')).toContain('var(--sky-ink)');

    for (const selector of ['.day.in-range', '.day.range-start', '.day.range-end', '.day.range-pending']) {
      const body = ruleBody(selector);
      expect(body).not.toBe('');
      for (const token of availability) {
        expect(body).not.toContain(`var(${token})`);
      }
      expect(alertTokens.some((token) => body.includes(`var(${token})`))).toBe(true);
    }
  });

  it('arms the calendar with the alert accent rather than the availability one', () => {
    const body = ruleBody('.calendar-panel.picking-range');
    expect(body).toContain('var(--alert)');
    expect(body).not.toContain('var(--sky)');
  });

  // The booking day, an available day and a watched day must stay three
  // distinguishable answers.
  it('defines the alert accent as its own hue, apart from availability and the booking day', () => {
    const alert = declaredValue('--alert');
    expect(alert).toMatch(/^#[0-9a-f]{6}$/i);
    expect(alert).not.toBe(declaredValue('--sky'));
    expect(alert).not.toBe(declaredValue('--red'));
  });

  it('meets contrast on both alert surfaces, at least as well as the teal it replaced', () => {
    const alert = declaredValue('--alert');
    const alertInk = declaredValue('--alert-ink');
    const alertTint = declaredValue('--alert-tint');

    // White caps on the solid accent, and the ink on the tinted interior.
    expect(contrastRatio(alert, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(alertInk, alertTint)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(alert, '#ffffff')).toBeGreaterThanOrEqual(
      contrastRatio(declaredValue('--sky'), '#ffffff'),
    );
  });

  // Hue is not the only cue: availability keeps its dot, the watched window
  // gets a bar.
  it('marks the watched window with a shape cue as well as a colour', () => {
    expect(ruleBody('.day.in-range::before')).toContain('content');
    expect(ruleBody('.day.avail::after')).toContain('border-radius: 50%');
  });
});

describe('shared content width', () => {
  it('measures the alert panel, the calendar and the day detail from one property', () => {
    for (const selector of ['.alert-panel', '.calendar-panel', '.day-detail']) {
      expect(ruleBody(selector)).toMatch(/padding:[^;]*var\(--panel-pad-x\)/);
    }
  });

  it('never re-pads one of them on its own at a breakpoint', () => {
    // Any horizontal padding on these blocks has to come through the property,
    // otherwise the alert row and the calendar drift apart at that width.
    const pattern = /(\.alert-panel|\.calendar-panel|\.day-detail)[^{}]*\{([^{}]*)\}/g;
    let match;
    while ((match = pattern.exec(css))) {
      const padding = /(?:^|\s)padding:\s*([^;]+);/.exec(match[2])?.[1];
      if (!padding) continue;
      const parts = padding.trim().split(/\s+(?![^(]*\))/);
      // 1 value = all sides, 2 = block/inline, 3 = top/inline/bottom, 4 = sides.
      const inline = parts.length === 1 ? parts[0] : parts[1];
      expect(inline).toBe('var(--panel-pad-x)');
    }
  });

  it('redefines the width for the whole main column, not per block', () => {
    const declarations = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) =>
      body.includes('--panel-pad-x:'),
    );

    // One base value plus at least one breakpoint override.
    expect(declarations.length).toBeGreaterThan(1);
    for (const [, selector] of declarations) {
      expect(selector.trim()).toMatch(/^(:root|\.pane-main)$/);
    }
  });
});
