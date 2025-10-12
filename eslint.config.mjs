// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
  ignores: ['dist/**', 'node_modules/**', '.issync/**', 'coverage/**'],
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
  },
})
