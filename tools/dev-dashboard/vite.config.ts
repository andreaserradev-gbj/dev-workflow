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
const appVersion = marketplace.plugins?.[0]?.version ?? pkg.version ?? '0.0.0';

// Build date is derived from the CHANGELOG entry for the current version, not the
// wall clock, so the committed client bundle is reproducible: the same version
// always yields the same date, hence the same Vite content hash. Falls back to
// the most recent dated entry when the exact version isn't in the log yet (e.g. a
// dev build before its release note is written).
const changelog = readFileSync(resolve(__dirname, '../../CHANGELOG.md'), 'utf-8');
const versionDateRe = new RegExp(
  `^##\\s+v${appVersion.replace(/\./g, '\\.')}\\s+-\\s+(\\d{4}-\\d{2}-\\d{2})`,
  'm',
);
const anyDateRe = /^##\s+v\d+\.\d+\.\d+\s+-\s+(\d{4}-\d{2}-\d{2})/m;
const buildDate = (changelog.match(versionDateRe) ?? changelog.match(anyDateRe))?.[1] ?? '';

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
