import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Ink components are authored as React JSX; make the test transform emit the
  // automatic react/jsx-runtime imports (mirrors tsconfig's jsx settings) so the
  // config is self-contained and does not depend on tsconfig discovery.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
