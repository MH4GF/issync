import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasIssyncInGitignore } from './gitignore.js'

describe('hasIssyncInGitignore', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(() => {
    // Save original working directory
    originalCwd = process.cwd()

    // Create test directory
    testDir = join(process.cwd(), '.test-gitignore')
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
    mkdirSync(testDir, { recursive: true })

    // Change to test directory
    process.chdir(testDir)
  })

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd)

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it('returns false when .gitignore does not exist', () => {
    expect(hasIssyncInGitignore()).toBe(false)
  })

  it('returns false when .gitignore exists but is empty', () => {
    writeFileSync('.gitignore', '')
    expect(hasIssyncInGitignore()).toBe(false)
  })

  it('returns false when .gitignore exists but does not contain .issync', () => {
    writeFileSync('.gitignore', 'node_modules/\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(false)
  })

  it('returns true when .gitignore contains .issync/', () => {
    writeFileSync('.gitignore', 'node_modules/\n.issync/\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns true when .gitignore contains .issync without trailing slash', () => {
    writeFileSync('.gitignore', 'node_modules/\n.issync\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns true when .gitignore contains /.issync/', () => {
    writeFileSync('.gitignore', 'node_modules/\n/.issync/\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns true when .gitignore contains .issync/*', () => {
    writeFileSync('.gitignore', 'node_modules/\n.issync/*\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns false when .issync is only in a comment', () => {
    writeFileSync('.gitignore', 'node_modules/\n# .issync/\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(false)
  })

  it('returns true when .issync has inline comment', () => {
    writeFileSync('.gitignore', 'node_modules/\n.issync/ # issync files\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns false when .gitignore contains only comments', () => {
    writeFileSync('.gitignore', '# Comment 1\n# Comment 2\n')
    expect(hasIssyncInGitignore()).toBe(false)
  })

  it('returns true when .issync is the first line', () => {
    writeFileSync('.gitignore', '.issync/\nnode_modules/\ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns true when .issync is the last line', () => {
    writeFileSync('.gitignore', 'node_modules/\ndist/\n.issync/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns false when .gitignore has only whitespace', () => {
    writeFileSync('.gitignore', '   \n\t\n  \n')
    expect(hasIssyncInGitignore()).toBe(false)
  })

  it('returns true when .issync has leading/trailing whitespace', () => {
    writeFileSync('.gitignore', 'node_modules/\n  .issync/  \ndist/\n')
    expect(hasIssyncInGitignore()).toBe(true)
  })

  it('returns false when file read fails (permission error simulation)', () => {
    // Create a directory named .gitignore to cause read error
    mkdirSync('.gitignore')
    expect(hasIssyncInGitignore()).toBe(false)
  })
})
