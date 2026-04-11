import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for DOM testing
    environment: 'jsdom',
    
    // Setup file for test utilities
    setupFiles: ['./vitest.setup.ts'],
    
    // Include patterns for test files
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    
    // Exclude patterns
    exclude: ['node_modules', 'dist', 'e2e'],
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'e2e/',
        '**/*.d.ts',
        'src/vite-env.d.ts',
        'src/routeTree.gen.ts',
        'src/main.tsx',
        // Exclude route files (tested via E2E)
        'src/routes/**',
        // Exclude third-party integrations (complex mocking)
        'src/components/whiteboard/**',
        'src/plugins/**',
      ],
      thresholds: {
        // Start with low thresholds, increase as coverage grows
        lines: 30,
        branches: 30,
        functions: 30,
        statements: 30,
      },
    },
    
    // Enable CSS if components use it
    css: true,
    
    // Reporters
    reporters: ['default'],
    
    // Timeout for each test
    testTimeout: 10000,
    
    // Pool options for better performance
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@frameer': path.resolve(__dirname, './frameer/src'),
    },
  },
});
