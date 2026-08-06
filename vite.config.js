import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// When VITE_PROXY_TARGET is set (see .env), the dev server proxies /wheely/*
// to that backend. The browser then only ever talks to localhost, so the
// HttpOnly SameSite=Lax refresh cookie is first-party and survives — calling
// a remote API directly from localhost is cross-site and the cookie is
// silently dropped, which forced a re-login every access-token expiry.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    server: {
      port: 5174,
      open: true,
      proxy: proxyTarget
        ? {
            '/wheely': {
              target: proxyTarget,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  };
});
