import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
  version?: string;
};
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
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
