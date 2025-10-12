import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from '../lib/config'
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
