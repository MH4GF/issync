import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config'
import { AmbiguousSyncError, SyncNotFoundError } from '../lib/errors'
import type { IssyncState } from '../types/index'
import { remove } from './remove'

const TEST_DIR = path.join(import.meta.dir, '../../.test-tmp/remove-test')

describe('remove command', () => {
  beforeEach(async () => {
    // Create clean test directory
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test('removes sync configuration by issue_url', () => {
    // Setup: Create state with 2 syncs
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

    // Execute
    remove({ issue: 'https://github.com/owner/repo/issues/1', cwd: TEST_DIR })

    // Verify
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(1)
    expect(newState.syncs[0]?.issue_url).toBe('https://github.com/owner/repo/issues/2')
  })

  test('removes sync configuration by local_file', () => {
    // Setup
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

    // Execute
    remove({ file: 'plan-1.md', cwd: TEST_DIR })

    // Verify
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(1)
    expect(newState.syncs[0]?.local_file).toBe(path.join(TEST_DIR, 'plan-2.md'))
  })

  test('deletes local file when --delete-file is specified', () => {
    // Setup
    const localFile = path.join(TEST_DIR, 'plan-1.md')
    writeFileSync(localFile, 'test content', 'utf-8')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: localFile,
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    expect(existsSync(localFile)).toBe(true)

    // Execute
    remove({ file: 'plan-1.md', deleteFile: true, cwd: TEST_DIR })

    // Verify file is deleted
    expect(existsSync(localFile)).toBe(false)

    // Verify sync is removed
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(0)
  })

  test('does not fail when deleting non-existent file with --delete-file', () => {
    // Setup: file does not exist
    const localFile = path.join(TEST_DIR, 'plan-1.md')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: localFile,
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    expect(existsSync(localFile)).toBe(false)

    // Execute - should not throw
    remove({ file: 'plan-1.md', deleteFile: true, cwd: TEST_DIR })

    // Verify sync is removed
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(0)
  })

  test('preserves other sync configurations (atomic update)', () => {
    // Setup: 3 syncs
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'plan-1.md'),
          comment_id: 123,
          last_synced_hash: 'hash1',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: path.join(TEST_DIR, 'plan-2.md'),
          comment_id: 456,
          last_synced_hash: 'hash2',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/3',
          local_file: path.join(TEST_DIR, 'plan-3.md'),
          comment_id: 789,
          last_synced_hash: 'hash3',
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute: remove middle sync
    remove({ issue: 'https://github.com/owner/repo/issues/2', cwd: TEST_DIR })

    // Verify: other syncs are preserved with all metadata
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(2)
    expect(newState.syncs[0]).toEqual({
      issue_url: 'https://github.com/owner/repo/issues/1',
      local_file: path.join(TEST_DIR, 'plan-1.md'),
      comment_id: 123,
      last_synced_hash: 'hash1',
    })
    expect(newState.syncs[1]).toEqual({
      issue_url: 'https://github.com/owner/repo/issues/3',
      local_file: path.join(TEST_DIR, 'plan-3.md'),
      comment_id: 789,
      last_synced_hash: 'hash3',
    })
  })

  test('throws SyncNotFoundError when sync does not exist', () => {
    // Setup: empty state
    const state: IssyncState = { syncs: [] }
    saveConfig(state, TEST_DIR)

    // Execute & Verify
    expect(() =>
      remove({ issue: 'https://github.com/owner/repo/issues/999', cwd: TEST_DIR }),
    ).toThrow(SyncNotFoundError)
  })

  test('throws AmbiguousSyncError when multiple syncs match (should not happen in practice)', () => {
    // Setup: This scenario is prevented by init, but we test error handling
    // In practice, selectSync would only return AmbiguousSyncError if no selector is provided
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

    // Execute & Verify: no selector provided
    expect(() => remove({ cwd: TEST_DIR })).toThrow(AmbiguousSyncError)
  })

  test('warns when watch_daemon_pid is present', () => {
    // Setup
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: path.join(TEST_DIR, 'plan-1.md'),
          watch_daemon_pid: 12345,
        },
      ],
    }
    saveConfig(state, TEST_DIR)

    // Execute - should log warning but not fail
    remove({ issue: 'https://github.com/owner/repo/issues/1', cwd: TEST_DIR })

    // Verify sync is removed despite warning
    const newState = loadConfig(TEST_DIR)
    expect(newState.syncs).toHaveLength(0)
  })
})
