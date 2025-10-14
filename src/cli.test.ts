import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('CLI version', () => {
  test('should display version from package.json in semver format', async () => {
    // Arrange: Read the expected version from package.json
    const packageJson = JSON.parse(
      readFileSync(join(import.meta.dir, '../package.json'), 'utf-8'),
    ) as { version?: string }

    if (!packageJson.version) {
      throw new Error('package.json must have a version field')
    }

    // Act: Execute the CLI with --version flag
    const proc = Bun.spawn(['bun', 'run', './src/cli.ts', '--version'], {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
    })

    const output = await new Response(proc.stdout).text()
    await proc.exited

    // Assert: CLI should output the same version as package.json
    expect(output.trim()).toBe(packageJson.version)
    // Assert: Version should follow semantic versioning format (X.Y.Z)
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
