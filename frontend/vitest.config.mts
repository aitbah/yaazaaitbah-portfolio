import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // Browser APIs jsdom lacks that the Radix primitives use.
    setupFiles: ['tests/setup.ts'],
    /**
     * Raised from the 5 s default.
     *
     * These tests render real Radix primitives into a jsdom with no layout
     * engine, and the workers compete for cores: a select with fifty options
     * costs a second or two on its own, and several files running at once push
     * whichever test happens to be slowest over the line. The failures that
     * produced were never the same test twice, which is the signature of a
     * budget rather than a bug.
     *
     * A generous timeout does not hide a slow application - nothing here waits
     * on the network, and the end-to-end suite times the real thing in a real
     * browser. It only stops a green suite from depending on how busy the
     * machine is.
     */
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Vendored shadcn primitives are upstream code. The App Router files,
      // the middleware and the next-intl request configuration are framework
      // entry points: wiring, which the end-to-end suite exercises through a
      // real browser rather than a mocked module registry. The home page's
      // motion is GSAP, Lenis and View Transitions driven by scroll, none of
      // which runs under jsdom; its rules live beside it in pure, unit-tested
      // modules, and the motion itself is driven end to end.
      exclude: [
        'src/components/ui/**',
        'src/hooks/**',
        'src/app/**',
        'src/proxy.ts',
        'src/i18n/**',
        'src/features/site/motion/**',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
