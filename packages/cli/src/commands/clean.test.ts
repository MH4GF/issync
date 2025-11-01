import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
import type { IssyncState } from '../types/index.js'
import { clean } from './clean.js'

const TEST_DIR = path.join(import.meta.dir, '../../.test-tmp/clean-test')

describe('clean command', () => {
  beforeEach(async () => {
    // Create clean test directory
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test('removes stale sync configurations (files do not exist)', async () => {
    // Setup: Create state with 3 syncs, only 1 file exists
    const existingFile = path.join(TEST_DIR, 'plan-2.md')
    writeFileSync(existingFile, 'content', 'utf-8')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'plan-1.md'), // Does not exist
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: existingFile, // Exists
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/3',
          local_file: path.join(TEST_DIR, 'plan-3.md'), // Does not exist
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute with force mode (skip confirmation)
    await clean({ force: true, cwd: TEST_DIR })

    // Verify: only sync with existing file remains
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(1)
    expect(newState.syncs[0]?.issue_url).toBe('https://github.com/owner/repo/issues/2')
    expect(newState.syncs[0]?.local_file).toBe(existingFile)
  })

  test('dry-run mode does not modify state.yml', async () => {
    // Setup: Create state with stale syncs
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'plan-1.md'), // Does not exist
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: path.join(TEST_DIR, 'plan-2.md'), // Does not exist
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute with dry-run
    await clean({ dryRun: true, cwd: TEST_DIR })

    // Verify: state unchanged
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(2)
  })

  test('handles zero stale syncs gracefully', async () => {
    // Setup: All files exist
    const file1 = path.join(TEST_DIR, 'plan-1.md')
    const file2 = path.join(TEST_DIR, 'plan-2.md')
    writeFileSync(file1, 'content1', 'utf-8')
    writeFileSync(file2, 'content2', 'utf-8')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: file1,
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: file2,
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute
    await clean({ cwd: TEST_DIR })

    // Verify: no changes, all syncs remain
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(2)
  })

  test('removes all syncs when all files are missing', async () => {
    // Setup: No files exist
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'plan-1.md'),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: path.join(TEST_DIR, 'plan-2.md'),
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute with force
    await clean({ force: true, cwd: TEST_DIR })

    // Verify: empty syncs
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(0)
  })

  test('preserves metadata of remaining syncs', async () => {
    // Setup: Mix of existing and non-existing files with metadata
    const existingFile = path.join(TEST_DIR, 'plan-2.md')
    writeFileSync(existingFile, 'content', 'utf-8')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'plan-1.md'),
          comment_id: 111,
          last_synced_hash: 'hash1',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: existingFile,
          comment_id: 222,
          last_synced_hash: 'hash2',
          last_synced_at: '2025-11-01T00:00:00Z',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/3',
          local_file: path.join(TEST_DIR, 'plan-3.md'),
          comment_id: 333,
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute with force
    await clean({ force: true, cwd: TEST_DIR })

    // Verify: metadata preserved
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(1)
    expect(newState.syncs[0]).toEqual({
      issue_url: 'https://github.com/owner/repo/issues/2',
      local_file: existingFile,
      comment_id: 222,
      last_synced_hash: 'hash2',
      last_synced_at: '2025-11-01T00:00:00Z',
    })
  })

  test('handles complex file paths correctly', async () => {
    // Setup: nested directories and absolute paths
    const nestedDir = path.join(TEST_DIR, 'nested', 'deep')
    await mkdir(nestedDir, { recursive: true })
    const existingFile = path.join(nestedDir, 'plan.md')
    writeFileSync(existingFile, 'content', 'utf-8')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'nonexistent', 'plan.md'),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: existingFile,
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute with force
    await clean({ force: true, cwd: TEST_DIR })

    // Verify
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(1)
    expect(newState.syncs[0]?.local_file).toBe(existingFile)
  })
})
