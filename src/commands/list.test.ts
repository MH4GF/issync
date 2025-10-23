import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveConfig } from '../lib/config.js'
import type { IssyncState, IssyncSync } from '../types/index.js'
import { formatSyncTable, list } from './list.js'

describe('formatSyncTable', () => {
  test('returns formatted table for single sync', () => {
    const syncs: IssyncSync[] = [
      {
        issue_url: 'https://github.com/owner/repo/issues/123',
        local_file: '.issync/docs/plan-123.md',
        comment_id: 111,
        last_synced_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
      },
    ]

    const result = formatSyncTable(syncs)

    expect(result).toContain('Issue URL')
    expect(result).toContain('Local File')
    expect(result).toContain('Last Synced')
    expect(result).toContain('https://github.com/owner/repo/issues/123')
    expect(result).toContain('.issync/docs/plan-123.md')
    expect(result).toMatch(/2h ago/)
  })

  test('returns formatted table for multiple syncs', () => {
    const syncs: IssyncSync[] = [
      {
        issue_url: 'https://github.com/owner/repo/issues/123',
        local_file: '.issync/docs/plan-123.md',
        comment_id: 111,
        last_synced_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
      {
        issue_url: 'https://github.com/owner/repo/issues/456',
        local_file: '.issync/docs/plan-456.md',
        comment_id: 222,
        last_synced_at: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
      },
    ]

    const result = formatSyncTable(syncs)
    const lines = result.split('\n')

    // Should have header + separator + 2 data rows = 4 lines
    expect(lines).toHaveLength(4)
    expect(result).toContain('https://github.com/owner/repo/issues/123')
    expect(result).toContain('https://github.com/owner/repo/issues/456')
    expect(result).toMatch(/2h ago/)
    expect(result).toMatch(/3d ago/)
  })

  test('handles missing last_synced_at with "Never"', () => {
    const syncs: IssyncSync[] = [
      {
        issue_url: 'https://github.com/owner/repo/issues/123',
        local_file: 'plan.md',
        comment_id: 111,
        // last_synced_at is missing
      },
    ]

    const result = formatSyncTable(syncs)

    expect(result).toContain('Never')
  })

  test('returns message for empty syncs array', () => {
    const result = formatSyncTable([])
    expect(result).toBe('No syncs configured.')
  })

  test('preserves sync order from input array', () => {
    const syncs: IssyncSync[] = [
      {
        issue_url: 'https://github.com/owner/repo/issues/3',
        local_file: 'third.md',
        comment_id: 333,
        last_synced_at: new Date(Date.now() - 1000).toISOString(),
      },
      {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: 'first.md',
        comment_id: 111,
        last_synced_at: new Date(Date.now() - 3000).toISOString(),
      },
      {
        issue_url: 'https://github.com/owner/repo/issues/2',
        local_file: 'second.md',
        comment_id: 222,
        last_synced_at: new Date(Date.now() - 2000).toISOString(),
      },
    ]

    const result = formatSyncTable(syncs)

    // Extract issue numbers from URLs in the result
    const lines = result.split('\n').filter((line) => line.includes('github.com'))
    const issueNumbers = lines.map((line) => {
      const match = line.match(/issues\/(\d+)/)
      return match ? Number.parseInt(match[1], 10) : null
    })

    expect(issueNumbers).toEqual([3, 1, 2])
  })
})

describe('list command', () => {
  let tempDir: string
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-list-'))
    consoleLogSpy = mock(() => {})
    console.log = consoleLogSpy
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('outputs formatted table to console', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act
    list({ cwd: tempDir })

    // Assert - verify console.log was called with the table
    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls.flat().join('\n')
    expect(output).toContain('Issue URL')
    expect(output).toContain('https://github.com/owner/repo/issues/123')
  })

  test('throws error when state.yml does not exist', () => {
    // Arrange: Use empty temp directory without state.yml

    // Act & Assert
    expect(() => list({ cwd: tempDir })).toThrow(
      "No syncs configured. Run 'issync init <issue-url>' to get started.",
    )
  })
})
