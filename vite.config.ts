import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

type ProxyResponse = {
  headers: {
    location?: string | string[];
  };
};

type ProxyWithResponseHook = {
  on(event: 'proxyRes', handler: (proxyRes: ProxyResponse) => void): void;
};

const defaultApiProxyTarget = 'https://getflights.ge';
type ApiProxyEnv = { VITE_API_PROXY_TARGET?: string | undefined };

function readProcessEnv(): ApiProxyEnv {
  return (globalThis as { process?: { env?: ApiProxyEnv } }).process?.env ?? {};
}

export function resolveApiProxyTarget(env: ApiProxyEnv = readProcessEnv()) {
  return env.VITE_API_PROXY_TARGET?.trim() || defaultApiProxyTarget;
}

const apiProxyTarget = resolveApiProxyTarget();

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/vs-backend': {
        target: 'https://ticket.vanillasky.ge',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        configure: (proxy) => {
          (proxy as unknown as ProxyWithResponseHook).on('proxyRes', (proxyRes) => {
            const location = proxyRes.headers.location;
            if (!location || Array.isArray(location)) return;

            const path = location.startsWith('http')
              ? new URL(location).pathname
              : location;
            proxyRes.headers.location = `/vs-backend${path}`;
          });
        },
        rewrite: (path) => path.replace(/^\/vs-backend/, ''),
      },
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: apiProxyTarget.startsWith('https://'),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
