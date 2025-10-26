// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', // All dist directories in workspaces
      '**/node_modules/**', // All node_modules
      '**/.issync/**', // All .issync directories
      '**/coverage/**', // All coverage directories
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Detect unnecessary async keywords
      '@typescript-eslint/require-await': 'error',
      // Enforce proper Promise handling
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Ensure awaiting thenable values (prevents awaiting non-promises)
      // Note: Bun Test's expect().rejects/.resolves return thenable-like objects
      // that should be awaited. This is intentional Bun Test behavior.
      '@typescript-eslint/await-thenable': 'error',
      // Enforce consistent return await in try-catch blocks
      // This prevents bugs where returned promises don't trigger catch blocks
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
    },
  },
)
