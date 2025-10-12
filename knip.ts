import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: ['src/cli.ts'],
  project: ['src/**/*.ts'],
  ignore: ['dist/**', '.issync/**'],
  ignoreDependencies: [],
  // tsc: TypeScript compiler used in type-check script
  // wait: bash built-in command used in check:ci script
  ignoreBinaries: ['tsc', 'wait'],
}

export default config
