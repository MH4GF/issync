import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncState } from '../types/index.js'
import { pull } from './pull.js'

type GitHubClientInstance = ReturnType<typeof githubModule.createGitHubClient>

describe('pull command - multi-sync support', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-pull-'))
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('pulls selected sync by file path', async () => {
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
        },
      ],
    }
    saveConfig(state, tempDir)

    const remoteBody = '# Remote Content'
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 222, body: remoteBody, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await pull({ cwd: tempDir, file: 'docs/two.md' })

    const pulledContent = readFileSync(path.join(tempDir, 'docs/two.md'), 'utf-8')
    expect(pulledContent).toBe(remoteBody)

    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')
    expect(sync?.last_synced_hash).toBe(calculateHash(remoteBody))
    expect(sync?.last_synced_at).toBeDefined()
  })

  test('pulls all syncs when no selector provided', async () => {
    const remoteBodyOne = '# Remote Content One'
    const remoteBodyTwo = '# Remote Content Two'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: (_, __, commentId) => {
        if (commentId === 111) {
          return Promise.resolve({
            id: 111,
            body: remoteBodyOne,
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        if (commentId === 222) {
          return Promise.resolve({
            id: 222,
            body: remoteBodyTwo,
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        throw new Error('Unexpected comment ID')
      },
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await pull({ cwd: tempDir })

    const pulledContentOne = readFileSync(path.join(tempDir, 'docs/one.md'), 'utf-8')
    const pulledContentTwo = readFileSync(path.join(tempDir, 'docs/two.md'), 'utf-8')
    expect(pulledContentOne).toBe(remoteBodyOne)
    expect(pulledContentTwo).toBe(remoteBodyTwo)

    const updatedState = loadConfig(tempDir)
    const syncOne = updatedState.syncs.find((entry) => entry.local_file === 'docs/one.md')
    const syncTwo = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')

    expect(syncOne?.last_synced_hash).toBe(calculateHash(remoteBodyOne))
    expect(syncTwo?.last_synced_hash).toBe(calculateHash(remoteBodyTwo))
    expect(syncOne?.last_synced_at).toBeDefined()
    expect(syncTwo?.last_synced_at).toBeDefined()
  })

  test('reports partial failures when some syncs fail', async () => {
    const remoteBodyOne = '# Remote Content One'
    const initialHashTwo = calculateHash('# Initial Content Two')
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
          last_synced_hash: initialHashTwo,
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: (_, __, commentId) => {
        if (commentId === 111) {
          return Promise.resolve({
            id: 111,
            body: remoteBodyOne,
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        throw new Error('API Error: Rate limit exceeded')
      },
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(pull({ cwd: tempDir })).rejects.toThrow('1 of 2 pull operation(s) failed')

    // Verify successful sync was updated
    const updatedState = loadConfig(tempDir)
    const syncOne = updatedState.syncs.find((entry) => entry.local_file === 'docs/one.md')
    const syncTwo = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')

    expect(syncOne?.last_synced_hash).toBe(calculateHash(remoteBodyOne))
    expect(syncOne?.last_synced_at).toBeDefined()

    // Failed sync should still have old hash
    expect(syncTwo?.last_synced_hash).toBe(initialHashTwo)

    // File should have been written for successful sync
    const pulledContentOne = readFileSync(path.join(tempDir, 'docs/one.md'), 'utf-8')
    expect(pulledContentOne).toBe(remoteBodyOne)
  })

  test('allows local files starting with double dots', async () => {
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '..docs/plan.md',
          comment_id: 999,
        },
      ],
    }
    saveConfig(state, tempDir)

    const remoteBody = '# Remote Content'
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 999, body: remoteBody, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await pull({ cwd: tempDir })

    const pulledContent = readFileSync(path.join(tempDir, '..docs/plan.md'), 'utf-8')
    expect(pulledContent).toBe(remoteBody)
  })

  test('skips pull when content unchanged', async () => {
    const remoteBody = '# Existing Content'
    const remoteHash = calculateHash(remoteBody)
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/plan.md',
          comment_id: 111,
          last_synced_hash: remoteHash, // Already synced
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: remoteBody, updated_at: '2025-01-01T00:00:00Z' }),
    }
    const getCommentSpy = spyOn(mockGitHubClient, 'getComment')
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await pull({ cwd: tempDir, file: 'docs/plan.md' })

    // Verify getComment was called (to fetch remote hash)
    expect(getCommentSpy).toHaveBeenCalledTimes(1)

    // Verify file was NOT written
    const planPath = path.join(tempDir, 'docs', 'plan.md')
    expect(existsSync(planPath)).toBe(false)

    // Verify hash and timestamp were NOT updated
    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs[0]
    expect(sync.last_synced_hash).toBe(remoteHash)
    expect(sync.last_synced_at).toBe('2025-01-01T00:00:00Z') // Unchanged
  })
})
