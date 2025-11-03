import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { hasIssyncInGitignore } from './gitignore'

const TEST_DIR = path.join(import.meta.dir, '../../.test-tmp/gitignore-test')

describe('hasIssyncInGitignore', () => {
  beforeEach(async () => {
    // Create clean test directory
    await rm(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test('returns false when .gitignore does not exist', () => {
    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('returns false when .gitignore exists but does not contain .issync', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.env\n*.log\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('returns true when .gitignore contains .issync/', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.issync/\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns true when .gitignore contains .issync (without trailing slash)', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.issync\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns true when .gitignore contains /.issync/', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n/.issync/\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns true when .gitignore contains .issync/*', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.issync/*\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns false when .issync appears only in comments', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n# .issync/\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('returns true when .issync is on a line with inline comments', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.issync/ # issync docs\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns true when .gitignore has .issync with extra whitespace', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n  .issync/  \n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns false when .gitignore only has empty lines', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, '\n\n\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('returns false when .gitignore only has comments', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, '# Comment 1\n# Comment 2\n# Comment 3\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('returns true when .issync appears at the end of file without newline', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.env\n.issync/')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })

  test('returns false when .gitignore is empty', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    writeFileSync(gitignorePath, '')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('handles file read errors gracefully', () => {
    // Create a directory named .gitignore (not a file)
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    mkdirSync(gitignorePath)

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(false)
  })

  test('matches patterns containing .issync even with different suffixes', () => {
    const gitignorePath = path.join(TEST_DIR, '.gitignore')
    // Note: This is a known tradeoff - partial match will also match .issync-backup
    writeFileSync(gitignorePath, 'node_modules/\n.issync-backup\n.env\n')

    const result = hasIssyncInGitignore(TEST_DIR)
    expect(result).toBe(true)
  })
})
