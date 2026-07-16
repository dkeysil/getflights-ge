// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveApiProxyTarget } from './vite.config';

describe('Vite API proxy target', () => {
  it('uses the deployed backend by default', () => {
    expect(resolveApiProxyTarget({})).toBe('https://getflights.ge');
  });

  it('allows local cache Worker override', () => {
    expect(resolveApiProxyTarget({ VITE_API_PROXY_TARGET: 'http://127.0.0.1:8788' })).toBe(
      'http://127.0.0.1:8788',
    );
  });
});
