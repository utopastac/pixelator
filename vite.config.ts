/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Serve `public/ios/index.html` for `/ios` + `/ios/` in the Vite dev server
 *  (SPA fallback otherwise swallows the directory and loads the React app). */
function iosMarketingIndex(): Plugin {
  return {
    name: 'ios-marketing-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/ios' || url === '/ios/') {
          req.url = '/ios/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), iosMarketingIndex()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Playwright specs live in ./e2e and must not be picked up by vitest —
    // they import from @playwright/test and run via `npm run e2e`.
    // `.claude/worktrees/**` holds peer git worktrees with their own deps
    // and tests; excluded here so vitest doesn't try to mount them against
    // this checkout's React.
    exclude: ['node_modules', 'dist', 'e2e/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
      ],
    },
  },
});
