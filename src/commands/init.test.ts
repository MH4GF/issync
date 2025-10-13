import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from '../lib/config'
import { FileAlreadyExistsError, InvalidFilePathError } from '../lib/errors'
import { init } from './init'

const TEST_DIR = path.join(import.meta.dir, '../../.test-tmp/init-test')

describe('init command', () => {
  beforeEach(async () => {
    // Create clean test directory
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test('creates .issync directory and state.yml with valid Issue URL', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/plan.md'

    init(issueUrl, { file: localFile, cwd: TEST_DIR })

    // Check .issync directory exists
    const issyncDir = path.join(TEST_DIR, '.issync')
    expect(existsSync(issyncDir)).toBe(true)

    // Check state.yml exists and has correct content
    const stateFile = path.join(issyncDir, 'state.yml')
    expect(existsSync(stateFile)).toBe(true)

    // Check local file was created
    const targetFile = path.join(TEST_DIR, localFile)
    expect(existsSync(targetFile)).toBe(true)
    expect(readFileSync(targetFile, 'utf-8')).toBe('')

    const config = loadConfig(TEST_DIR)

    expect(config.issue_url).toBe(issueUrl)
    expect(config.local_file).toBe(localFile)
    expect(config.comment_id).toBeUndefined()
    expect(config.last_synced_hash).toBeUndefined()
  })

  test('uses default file path when not specified', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'

    init(issueUrl, { cwd: TEST_DIR })

    const config = loadConfig(TEST_DIR)

    expect(config.local_file).toBe('docs/plan.md')
  })

  test('creates file from template when provided', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/notes/plan.md'
    const templatesDir = path.join(TEST_DIR, 'templates')
    const templateFile = path.join(templatesDir, 'base.md')

    mkdirSync(templatesDir, { recursive: true })
    writeFileSync(templateFile, '# Template', 'utf-8')

    init(issueUrl, {
      file: localFile,
      cwd: TEST_DIR,
      template: path.relative(TEST_DIR, templateFile),
    })

    const createdFile = path.join(TEST_DIR, localFile)
    expect(existsSync(createdFile)).toBe(true)
    expect(readFileSync(createdFile, 'utf-8')).toBe('# Template')
  })

  test('allows existing file when template not provided', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/plan.md'
    const targetFile = path.join(TEST_DIR, localFile)
    const originalContent = 'existing'

    mkdirSync(path.dirname(targetFile), { recursive: true })
    writeFileSync(targetFile, originalContent, 'utf-8')

    init(issueUrl, { file: localFile, cwd: TEST_DIR })

    expect(readFileSync(targetFile, 'utf-8')).toBe(originalContent)
  })

  test('throws error when template is provided and target file exists', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/plan.md'
    const targetFile = path.join(TEST_DIR, localFile)
    const templateFile = path.join(TEST_DIR, 'templates', 'base.md')

    mkdirSync(path.dirname(targetFile), { recursive: true })
    mkdirSync(path.dirname(templateFile), { recursive: true })
    writeFileSync(targetFile, 'existing', 'utf-8')
    writeFileSync(templateFile, '# Template', 'utf-8')

    expect(() =>
      init(issueUrl, {
        file: localFile,
        cwd: TEST_DIR,
        template: path.relative(TEST_DIR, templateFile),
      }),
    ).toThrow(FileAlreadyExistsError)
  })

  test('accepts file paths containing leading double dots in the name', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = '..docs/plan.md'

    init(issueUrl, { file: localFile, cwd: TEST_DIR })

    const createdFile = path.join(TEST_DIR, localFile)
    expect(existsSync(createdFile)).toBe(true)
    expect(readFileSync(createdFile, 'utf-8')).toBe('')
  })

  test('rejects file paths that escape the working directory', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'

    expect(() => init(issueUrl, { file: '../plan.md', cwd: TEST_DIR })).toThrow(
      InvalidFilePathError,
    )
  })

  test('throws error for invalid GitHub Issue URL', () => {
    const invalidUrl = 'https://github.com/owner/repo/pull/123' // PR URL, not Issue

    expect(() => init(invalidUrl, { cwd: TEST_DIR })).toThrow()
  })

  test('throws error when state.yml already exists', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'

    // First initialization
    init(issueUrl, { cwd: TEST_DIR })

    // Second initialization should fail
    expect(() => init(issueUrl, { cwd: TEST_DIR })).toThrow(/already initialized/)
  })

  test('creates .issync directory if it does not exist', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const issyncDir = path.join(TEST_DIR, '.issync')

    expect(existsSync(issyncDir)).toBe(false)

    init(issueUrl, { cwd: TEST_DIR })

    expect(existsSync(issyncDir)).toBe(true)
  })
})
