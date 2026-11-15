import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC instead of esbuild: Nest DI needs emitDecoratorMetadata
const swcPlugin = () => swc.vite({ module: { type: 'es6' } });

// E2E env: .env.test only (never merged with .env, to avoid leaking dev values)
const loadTestEnv = (): Record<string, string> => {
  try {
    return parseEnv(readFileSync('.env.test', 'utf-8')) as Record<
      string,
      string
    >;
  } catch {
    return {}; // CI provides env vars directly
  }
};

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.mock.ts',
        'src/**/*.spec.ts',
      ],
      reportsDirectory: './coverage',
      // Merged unit + E2E coverage (npm run test:cov), checked in CI.
      // Set a few points below the current level (2026-11-15: 99.4 / 94.8 / 100 / 99.8):
      // raise them by hand from time to time, never lower them without a reason.
      thresholds: {
        statements: 97,
        branches: 90,
        functions: 97,
        lines: 97,
      },
    },
    projects: [
      {
        plugins: [swcPlugin()],
        test: {
          name: 'unit',
          globals: true, // describe/it/expect/vi available without imports
          environment: 'node',
          include: ['src/**/*.spec.ts'],
          // when both projects run (test:cov), unit tests first, then E2E alone:
          // running them together starves the CPU-heavy E2E tests (bcrypt)
          sequence: { groupOrder: 0 },
        },
      },
      {
        plugins: [swcPlugin()],
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: ['test/**/*.e2e-spec.ts'],
          env: loadTestEnv(),
          globalSetup: ['test/setup/global-setup.ts'],
          sequence: { groupOrder: 1 },
          fileParallelism: false, // all suites share the same database
          // real bcrypt + database: margin for slow machines and CI runners
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
