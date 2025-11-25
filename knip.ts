import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'dist/**',
    '.issync/**',
    '.git/**', // Git directory (especially for worktrees)
    '**/*.test.ts', // Test files are not production code
    '**/test-helpers.ts', // Test utilities
  ],
  ignoreDependencies: [
    'lucide-react', // Used in shadcn/ui components (future use)
  ],
  ignoreExportsUsedInFile: true,
  // tsc: TypeScript compiler used in type-check script
  ignoreBinaries: ['tsc'],
}

export default config
