import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['packages/cli/src/**/*.ts', 'apps/web/src/**/*.tsx'],
      project: ['packages/cli/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    },
  },
  ignore: [
    'dist/**',
    '.issync/**',
    '.git/**', // Git directory (especially for worktrees)
    '**/*.test.ts', // Test files are not production code
    '**/test-helpers.ts', // Test utilities
  ],
  ignoreDependencies: [
    'lucide-react', // Used in shadcn/ui components (future use)
    'tailwindcss', // Required by @tailwindcss/postcss
    'tw-animate-css', // TailwindCSS animation utilities
  ],
  ignoreExportsUsedInFile: true,
  // tsc: TypeScript compiler used in type-check script
  ignoreBinaries: ['tsc'],
}

export default config
