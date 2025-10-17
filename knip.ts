import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  project: ['src/**/*.ts'],
  ignore: ['dist/**', '.issync/**'],
  ignoreDependencies: [],
  // tsc: TypeScript compiler used in type-check script
  ignoreBinaries: ['tsc'],
}

export default config
