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
          local_file: '.issync/docs/plan-123.md',
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

    await pull({ cwd: tempDir, file: '.issync/docs/plan-123.md' })

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

  test('returns false when content unchanged', async () => {
    const remoteBody = '# Existing Content'
    const remoteHash = calculateHash(remoteBody)
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_hash: remoteHash,
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: remoteBody, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    const hasChanges = await pull({ cwd: tempDir, file: '.issync/docs/plan-123.md' })

    expect(hasChanges).toBe(false)
  })

  test('returns true when content has changed', async () => {
    const oldBody = '# Old Content'
    const newBody = '# New Content'
    const oldHash = calculateHash(oldBody)
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_hash: oldHash,
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: newBody, updated_at: '2025-01-02T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    const hasChanges = await pull({ cwd: tempDir, file: '.issync/docs/plan-123.md' })

    expect(hasChanges).toBe(true)

    // Verify file was written
    const pulledContent = readFileSync(path.join(tempDir, '.issync/docs/plan-123.md'), 'utf-8')
    expect(pulledContent).toBe(newBody)
  })

  test('returns true when any sync has changes in multi-sync pull', async () => {
    const unchangedBody = '# Unchanged Content'
    const changedBody = '# Changed Content'
    const unchangedHash = calculateHash(unchangedBody)
    const oldHash = calculateHash('# Old Content')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/unchanged.md',
          comment_id: 111,
          last_synced_hash: unchangedHash,
          last_synced_at: '2025-01-01T00:00:00Z',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/changed.md',
          comment_id: 222,
          last_synced_hash: oldHash,
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: (_, __, commentId) => {
        if (commentId === 111) {
          return Promise.resolve({
            id: 111,
            body: unchangedBody,
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        if (commentId === 222) {
          return Promise.resolve({
            id: 222,
            body: changedBody,
            updated_at: '2025-01-02T00:00:00Z',
          })
        }
        throw new Error('Unexpected comment ID')
      },
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    const hasChanges = await pull({ cwd: tempDir })

    expect(hasChanges).toBe(true)
  })

  test('returns false when all syncs are unchanged in multi-sync pull', async () => {
    const unchangedBody1 = '# Unchanged Content 1'
    const unchangedBody2 = '# Unchanged Content 2'
    const unchangedHash1 = calculateHash(unchangedBody1)
    const unchangedHash2 = calculateHash(unchangedBody2)

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/unchanged1.md',
          comment_id: 111,
          last_synced_hash: unchangedHash1,
          last_synced_at: '2025-01-01T00:00:00Z',
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/unchanged2.md',
          comment_id: 222,
          last_synced_hash: unchangedHash2,
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: (_, __, commentId) => {
        if (commentId === 111) {
          return Promise.resolve({
            id: 111,
            body: unchangedBody1,
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        if (commentId === 222) {
          return Promise.resolve({
            id: 222,
            body: unchangedBody2,
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        throw new Error('Unexpected comment ID')
      },
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    const hasChanges = await pull({ cwd: tempDir })

    expect(hasChanges).toBe(false)
  })
})

describe('pull command - local diff detection', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-pull-local-diff-'))
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('throws LocalChangeError when local file has unsaved changes', async () => {
    const { writeFile } = await import('node:fs/promises')
    const localContent = '# Local Changes'
    const remoteContent = '# Remote Changes'
    const lastSyncedContent = '# Last Synced Content'

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 111,
          last_synced_hash: calculateHash(lastSyncedContent),
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Write local file with different content
    await writeFile(path.join(tempDir, 'docs/test.md'), localContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: remoteContent, updated_at: '2025-01-02T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Should throw LocalChangeError
    await expect(pull({ cwd: tempDir, file: 'docs/test.md' })).rejects.toThrow(
      'Local file has unsaved changes',
    )

    // Verify local file was NOT overwritten
    const localContentAfter = readFileSync(path.join(tempDir, 'docs/test.md'), 'utf-8')
    expect(localContentAfter).toBe(localContent)
  })

  test('force pull overwrites local changes', async () => {
    const { writeFile } = await import('node:fs/promises')
    const localContent = '# Local Changes'
    const remoteContent = '# Remote Changes'
    const lastSyncedContent = '# Last Synced Content'

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 111,
          last_synced_hash: calculateHash(lastSyncedContent),
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Write local file with different content
    await writeFile(path.join(tempDir, 'docs/test.md'), localContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: remoteContent, updated_at: '2025-01-02T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Should succeed with force option
    const hasChanges = await pull({ cwd: tempDir, file: 'docs/test.md', force: true })

    expect(hasChanges).toBe(true)

    // Verify local file was overwritten with remote content
    const localContentAfter = readFileSync(path.join(tempDir, 'docs/test.md'), 'utf-8')
    expect(localContentAfter).toBe(remoteContent)

    // Verify hash was updated
    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs[0]
    expect(sync.last_synced_hash).toBe(calculateHash(remoteContent))
  })

  test('succeeds when local file does not exist', async () => {
    const remoteContent = '# Remote Content'
    const lastSyncedContent = '# Last Synced Content'

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 111,
          last_synced_hash: calculateHash(lastSyncedContent),
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Do NOT create local file

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: remoteContent, updated_at: '2025-01-02T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Should succeed (no local file to check)
    const hasChanges = await pull({ cwd: tempDir, file: 'docs/test.md' })

    expect(hasChanges).toBe(true)

    // Verify file was created with remote content
    const localContent = readFileSync(path.join(tempDir, 'docs/test.md'), 'utf-8')
    expect(localContent).toBe(remoteContent)
  })

  test('succeeds when local file matches last_synced_hash', async () => {
    const { writeFile } = await import('node:fs/promises')
    const lastSyncedContent = '# Last Synced Content'
    const remoteContent = '# Remote Changes'

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 111,
          last_synced_hash: calculateHash(lastSyncedContent),
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Write local file with same content as last synced
    await writeFile(path.join(tempDir, 'docs/test.md'), lastSyncedContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 111, body: remoteContent, updated_at: '2025-01-02T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Should succeed (local matches last synced)
    const hasChanges = await pull({ cwd: tempDir, file: 'docs/test.md' })

    expect(hasChanges).toBe(true)

    // Verify file was overwritten with remote content
    const localContentAfter = readFileSync(path.join(tempDir, 'docs/test.md'), 'utf-8')
    expect(localContentAfter).toBe(remoteContent)
  })

  test('reports partial failures with local changes in multi-sync pull', async () => {
    const { writeFile } = await import('node:fs/promises')
    const remoteContentOne = '# Remote Content One'
    const localContentTwo = '# Local Changes Two'
    const remoteContentTwo = '# Remote Content Two'
    const lastSyncedContentTwo = '# Last Synced Content Two'

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
          last_synced_hash: calculateHash(lastSyncedContentTwo),
          last_synced_at: '2025-01-01T00:00:00Z',
        },
      ],
    }
    saveConfig(state, tempDir)

    // Write local file with different content for second sync
    await writeFile(path.join(tempDir, 'docs/two.md'), localContentTwo, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: (_, __, commentId) => {
        if (commentId === 111) {
          return Promise.resolve({
            id: 111,
            body: remoteContentOne,
            updated_at: '2025-01-02T00:00:00Z',
          })
        }
        if (commentId === 222) {
          return Promise.resolve({
            id: 222,
            body: remoteContentTwo,
            updated_at: '2025-01-02T00:00:00Z',
          })
        }
        throw new Error('Unexpected comment ID')
      },
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Should throw for partial failures
    await expect(pull({ cwd: tempDir })).rejects.toThrow('1 of 2 pull operation(s) failed')

    // Verify first sync succeeded
    const contentOne = readFileSync(path.join(tempDir, 'docs/one.md'), 'utf-8')
    expect(contentOne).toBe(remoteContentOne)

    // Verify second sync did NOT overwrite local file
    const contentTwo = readFileSync(path.join(tempDir, 'docs/two.md'), 'utf-8')
    expect(contentTwo).toBe(localContentTwo)
  })
})
