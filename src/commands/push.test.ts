import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
import { AmbiguousSyncError } from '../lib/errors.js'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncState } from '../types/index.js'
import { push } from './push.js'

type GitHubClientInstance = InstanceType<typeof githubModule.GitHubClient>

describe('push command - multi-sync support', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-push-'))
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('pushes selected sync by file path', async () => {
    const previousBody = '# Remote Content'
    const localBody = '# Updated Content'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
          last_synced_hash: calculateHash(previousBody),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, 'docs'), { recursive: true })
    await writeFile(path.join(tempDir, 'docs/two.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() => Promise.resolve())
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({ id: 222, body: previousBody, updated_at: '2025-01-01T00:00:00Z' }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'GitHubClient').mockImplementation(
      () => mockGitHubClient as unknown as githubModule.GitHubClient,
    )

    await push({ cwd: tempDir, file: 'docs/two.md' })

    expect(updateComment).toHaveBeenCalledTimes(1)
    const firstCall = updateComment.mock.calls[0]
    expect(firstCall).toBeDefined()
    if (!firstCall) {
      throw new Error('Expected updateComment to be called at least once')
    }
    const [owner, repo, commentId, content] = firstCall
    expect(`${owner}/${repo}`).toBe('owner/repo')
    expect(commentId).toBe(222)
    expect(content).toBe(localBody)

    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')
    expect(sync?.last_synced_hash).toBe(calculateHash(localBody))
    expect(sync?.last_synced_at).toBeDefined()
  })

  test('throws when multiple syncs exist without selector', () => {
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

    return expect(push({ cwd: tempDir })).rejects.toThrow(AmbiguousSyncError)
  })

  test('allows local files starting with double dots', async () => {
    const localBody = '# Updated Content'
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

    await mkdir(path.join(tempDir, '..docs'), { recursive: true })
    await writeFile(path.join(tempDir, '..docs/plan.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() => Promise.resolve())
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({ id: 999, body: '# Remote Content', updated_at: '2025-01-01T00:00:00Z' }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'GitHubClient').mockImplementation(
      () => mockGitHubClient as unknown as githubModule.GitHubClient,
    )

    await push({ cwd: tempDir })

    expect(updateComment).toHaveBeenCalledTimes(1)
    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs[0]
    expect(sync?.last_synced_hash).toBe(calculateHash(localBody))
  })
})
