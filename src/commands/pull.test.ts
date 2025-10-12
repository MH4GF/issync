import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config'
import type { IssyncConfig } from '../types'
import { pull } from './pull'

const TEST_DIR = path.join(import.meta.dir, '../../.test-tmp/pull-test')

describe.skip('pull command', () => {
  beforeEach(async () => {
    // Create clean test directory
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test('pulls remote comment and writes to local file', async () => {
    // Setup: Initialize with config
    const config: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/123',
      comment_id: 456,
      local_file: 'test.md',
    }
    saveConfig(config, TEST_DIR)

    // Mock GitHub client will be needed here
    // For now, test the basic structure

    await pull({ cwd: TEST_DIR })

    // Verify file was created
    const filePath = path.join(TEST_DIR, 'test.md')
    expect(existsSync(filePath)).toBe(true)
  })

  test('updates state.yml with last_synced_hash', async () => {
    // Setup
    const config: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/123',
      comment_id: 456,
      local_file: 'test.md',
    }
    saveConfig(config, TEST_DIR)

    await pull({ cwd: TEST_DIR })

    // Verify config was updated
    const updatedConfig = loadConfig(TEST_DIR)
    expect(updatedConfig.last_synced_hash).toBeDefined()
    expect(updatedConfig.last_synced_at).toBeDefined()
  })

  test('overwrites existing local file', async () => {
    // Setup
    const config: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/123',
      comment_id: 456,
      local_file: 'test.md',
    }
    saveConfig(config, TEST_DIR)

    // Create existing file
    const filePath = path.join(TEST_DIR, 'test.md')
    await writeFile(filePath, 'old content', 'utf-8')

    await pull({ cwd: TEST_DIR })

    // Verify file was overwritten
    const content = await readFile(filePath, 'utf-8')
    expect(content).not.toBe('old content')
  })

  test('throws error when not initialized', async () => {
    await expect(pull({ cwd: TEST_DIR })).rejects.toThrow()
  })
})
