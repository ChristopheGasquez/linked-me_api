import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC instead of esbuild: Nest DI needs emitDecoratorMetadata
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true, // describe/it/expect/vi available without imports
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
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
  },
});
