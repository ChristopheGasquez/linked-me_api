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
    },
    projects: [
      {
        plugins: [swcPlugin()],
        test: {
          name: 'unit',
          globals: true, // describe/it/expect/vi available without imports
          environment: 'node',
          include: ['src/**/*.spec.ts'],
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
          fileParallelism: false, // all suites share the same database
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
