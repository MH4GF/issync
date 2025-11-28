import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveConfig } from '../lib/config.js'
import type { IssyncState } from '../types/index.js'
import { status } from './status.js'

describe('status command', () => {
  let tempDir: string
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-status-'))
    consoleLogSpy = mock(() => {})
    console.log = consoleLogSpy
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('outputs formatted status for specified issue URL', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: '2025-11-28T10:30:00Z',
          last_synced_hash: 'abc123defghi',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/456',
          local_file: '.issync/docs/plan-456.md',
          comment_id: 222,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    status('https://github.com/owner/repo/issues/123', { cwd: tempDir })

    // Assert
    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain('Sync Configuration:')
    expect(output).toContain('Issue URL:       https://github.com/owner/repo/issues/123')
    expect(output).toContain('Local File:      .issync/docs/plan-123.md')
    expect(output).toContain('Comment ID:      111')
    expect(output).toContain('Last Synced:     2025-11-28T10:30:00Z')
    expect(output).toContain('Last Hash:       abc123defghi...')
  })

  test('outputs JSON format when --json option is specified', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: '2025-11-28T10:30:00Z',
          last_synced_hash: 'abc123def',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    status('https://github.com/owner/repo/issues/123', { cwd: tempDir, json: true })

    // Assert
    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    const parsed = JSON.parse(output)
    expect(parsed.issue_url).toBe('https://github.com/owner/repo/issues/123')
    expect(parsed.local_file).toBe('.issync/docs/plan-123.md')
    expect(parsed.comment_id).toBe(111)
    expect(parsed.last_synced_at).toBe('2025-11-28T10:30:00Z')
    expect(parsed.last_synced_hash).toBe('abc123def')
  })

  test('displays optional fields when present', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          poll_interval: 30,
          watch_daemon_pid: 12345,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    status('https://github.com/owner/repo/issues/123', { cwd: tempDir })

    // Assert
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain('Poll Interval:   30s')
    expect(output).toContain('Watch Daemon:    Running (PID: 12345)')
  })

  test('displays "Not created yet" when comment_id is missing', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    status('https://github.com/owner/repo/issues/123', { cwd: tempDir })

    // Assert
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain('Comment ID:      Not created yet')
  })

  test('displays "Never" when last_synced_at is missing', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    status('https://github.com/owner/repo/issues/123', { cwd: tempDir })

    // Assert
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain('Last Synced:     Never')
  })

  test('displays "None" when last_synced_hash is missing', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    status('https://github.com/owner/repo/issues/123', { cwd: tempDir })

    // Assert
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain('Last Hash:       None')
  })

  test('throws error when issue URL is not found', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act & Assert
    expect(() => status('https://github.com/owner/repo/issues/999', { cwd: tempDir })).toThrow(
      'No sync entry found for issue: https://github.com/owner/repo/issues/999',
    )
  })

  test('throws error when state.yml does not exist', () => {
    // Arrange: Use empty temp directory without state.yml

    // Act & Assert
    expect(() => status('https://github.com/owner/repo/issues/123', { cwd: tempDir })).toThrow()
  })
})
