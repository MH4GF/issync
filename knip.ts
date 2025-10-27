import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'dist/**',
    '.issync/**',
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
