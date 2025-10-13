import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
import { AmbiguousSyncError } from '../lib/errors.js'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncState } from '../types/index.js'
import { pull } from './pull.js'

type GitHubClientInstance = InstanceType<typeof githubModule.GitHubClient>

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
    spyOn(githubModule, 'GitHubClient').mockImplementation(
      () => mockGitHubClient as unknown as githubModule.GitHubClient,
    )

    await pull({ cwd: tempDir, file: 'docs/two.md' })

    const pulledContent = readFileSync(path.join(tempDir, 'docs/two.md'), 'utf-8')
    expect(pulledContent).toBe(remoteBody)

    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')
    expect(sync?.last_synced_hash).toBe(calculateHash(remoteBody))
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

    return expect(pull({ cwd: tempDir })).rejects.toThrow(AmbiguousSyncError)
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
    spyOn(githubModule, 'GitHubClient').mockImplementation(
      () => mockGitHubClient as unknown as githubModule.GitHubClient,
    )

    await pull({ cwd: tempDir })

    const pulledContent = readFileSync(path.join(tempDir, '..docs/plan.md'), 'utf-8')
    expect(pulledContent).toBe(remoteBody)
  })
})
