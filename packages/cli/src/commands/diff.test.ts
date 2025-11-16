import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveConfig } from '../lib/config.js'
import * as githubModule from '../lib/github.js'
import type { IssyncState } from '../types/index.js'
import { diff } from './diff.js'

type GitHubClientInstance = ReturnType<typeof githubModule.createGitHubClient>

describe('diff command', () => {
  let tempDir: string
  let consoleLogSpy: ReturnType<typeof spyOn>

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-diff-'))
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('shows no differences when local and remote are identical', async () => {
    const content = '# Test Content\n\nSome text here.'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 123,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Create local file
    const localFilePath = path.join(tempDir, 'docs/test.md')
    await writeFile(localFilePath, content, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 123, body: content, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await diff({ cwd: tempDir, file: 'docs/test.md', color: false })

    expect(consoleLogSpy).toHaveBeenCalledWith('No differences found')
  })

  test('shows diff when local and remote have differences', async () => {
    const localContent = '# Test Content\n\nLocal changes here.'
    const remoteContent = '# Test Content\n\nRemote changes here.'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 123,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Create local file
    const localFilePath = path.join(tempDir, 'docs/test.md')
    await writeFile(localFilePath, localContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 123, body: remoteContent, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await diff({ cwd: tempDir, file: 'docs/test.md', color: false })

    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls[0][0] as string
    expect(output).toContain('--- a/test.md')
    expect(output).toContain('+++ b/remote')
    expect(output).toContain('-Remote changes here.')
    expect(output).toContain('+Local changes here.')
  })

  test('handles sync with no comment_id (empty remote)', async () => {
    const localContent = '# Test Content\n\nLocal only.'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: undefined,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Create local file
    const localFilePath = path.join(tempDir, 'docs/test.md')
    await writeFile(localFilePath, localContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () => Promise.reject(new Error('Should not be called')),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await diff({ cwd: tempDir, file: 'docs/test.md', color: false })

    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls[0][0] as string
    expect(output).toContain('--- a/test.md')
    expect(output).toContain('+++ b/remote')
    expect(output).toContain('+# Test Content')
    expect(output).toContain('+Local only.')
  })

  test('removes issync markers before comparing', async () => {
    const localContent = '<!-- issync:v1:start -->\n# Test\nLocal\n<!-- issync:v1:end -->'
    const remoteContent = '<!-- issync:v1:start -->\n# Test\nRemote\n<!-- issync:v1:end -->'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/test.md',
          comment_id: 123,
        },
      ],
    }
    saveConfig(state, tempDir)

    // Create local file
    const localFilePath = path.join(tempDir, 'docs/test.md')
    await writeFile(localFilePath, localContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 123, body: remoteContent, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await diff({ cwd: tempDir, file: 'docs/test.md', color: false })

    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls[0][0] as string
    // Markers should be removed, so diff should only show content differences
    expect(output).not.toContain('issync:v1:start')
    expect(output).not.toContain('issync:v1:end')
    expect(output).toContain('-Remote')
    expect(output).toContain('+Local')
  })

  test('selects sync by issue URL', async () => {
    const localContent = '# Test Content\n\nLocal.'
    const remoteContent = '# Test Content\n\nRemote.'
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

    // Create local file
    const localFilePath = path.join(tempDir, 'docs/two.md')
    await writeFile(localFilePath, localContent, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({ id: 222, body: remoteContent, updated_at: '2025-01-01T00:00:00Z' }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await diff({
      cwd: tempDir,
      issue: 'https://github.com/owner/repo/issues/2',
      color: false,
    })

    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls[0][0] as string
    expect(output).toContain('--- a/two.md')
    expect(output).toContain('+++ b/remote')
  })
})
