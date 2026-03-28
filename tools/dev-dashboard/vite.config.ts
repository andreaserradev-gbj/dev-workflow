import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
  version?: string;
};
const marketplace = JSON.parse(
  readFileSync(resolve(__dirname, '../../.claude-plugin/marketplace.json'), 'utf-8'),
) as {
  plugins?: Array<{
    version?: string;
  }>;
};
const buildDate = new Date().toISOString().slice(0, 10);
const appVersion = marketplace.plugins?.[0]?.version ?? pkg.version ?? '0.0.0';

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  root: 'src/client',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3141',
      '/ws': {
        target: 'ws://localhost:3141',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
