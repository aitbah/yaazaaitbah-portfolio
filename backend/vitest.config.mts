import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // One-off scripts and the process entry point are composition, not logic:
      // covering them would mean asserting that main() calls what it calls.
      // `placeholder-image.ts` is deliberately not among them - it is a
      // hand-written PNG encoder, which is logic wherever it happens to live.
      exclude: [
        'src/server.ts',
        'src/features/auth/create-admin.ts',
        'src/features/auth/change-admin-email.ts',
        'src/features/auth/change-admin-password.ts',
        'src/prune-uploads.ts',
        'src/sync-indexes.ts',
        'src/seed-options.ts',
        'src/seed/seed.ts',
        'src/seed/seed-data.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
    // Config validation runs at import time, so tests need a valid environment.
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://mongo:27017/portfolio_test',
      FRONTEND_URL: 'http://localhost:3000',
      JWT_SECRET: 'test-secret-value-with-at-least-32-chars',
      LOG_LEVEL: 'silent',
    },
  },
});
