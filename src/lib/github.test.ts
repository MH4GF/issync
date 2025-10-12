import { describe, expect, test } from 'bun:test'
import { GitHubClient } from './github'

describe('GitHubClient', () => {
  describe('parseIssueUrl', () => {
    // init コマンドで Issue URL を解析し、owner/repo/issue_number を取得する
    // この情報は GitHub API 呼び出しに必要
    test('標準的な GitHub Issue URL をパースできる', () => {
      // Arrange
      const client = new GitHubClient()
      const url = 'https://github.com/MH4GF/issync/issues/123'

      // Act
      const result = client.parseIssueUrl(url)

      // Assert: 正しい owner, repo, issue_number を抽出
      expect(result).toEqual({
        owner: 'MH4GF',
        repo: 'issync',
        issue_number: 123,
      })
    })

    // ユーザーが http:// でURLをコピーした場合も動作する
    test('http プロトコルの URL もパースできる', () => {
      // Arrange
      const client = new GitHubClient()
      const url = 'http://github.com/owner/repo/issues/456'

      // Act
      const result = client.parseIssueUrl(url)

      // Assert
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        issue_number: 456,
      })
    })

    // ユーザーがクエリパラメータ付きでURLをコピーした場合も動作する
    test('クエリパラメータ付きの URL もパースできる', () => {
      // Arrange
      const client = new GitHubClient()
      const url = 'https://github.com/facebook/react/issues/12345?foo=bar'

      // Act
      const result = client.parseIssueUrl(url)

      // Assert: クエリパラメータは無視される
      expect(result).toEqual({
        owner: 'facebook',
        repo: 'react',
        issue_number: 12345,
      })
    })

    // 不正な URL に対して明確なエラーを返す（ユーザーフレンドリー）
    test('Issue URL ではない場合はエラーを投げる', () => {
      // Arrange
      const client = new GitHubClient()
      const urlWithoutIssueNumber = 'https://github.com/owner/repo'

      // Act & Assert: Issue 番号がない URL は拒否
      expect(() => client.parseIssueUrl(urlWithoutIssueNumber)).toThrow('Invalid GitHub Issue URL')
    })

    test('Pull Request URL の場合はエラーを投げる', () => {
      // Arrange
      const client = new GitHubClient()
      const pullRequestUrl = 'https://github.com/owner/repo/pulls/123'

      // Act & Assert: PR URL は Issue URL ではない
      expect(() => client.parseIssueUrl(pullRequestUrl)).toThrow('Invalid GitHub Issue URL')
    })

    test('GitHub 以外の URL の場合はエラーを投げる', () => {
      // Arrange
      const client = new GitHubClient()
      const nonGitHubUrl = 'https://example.com/issues/123'

      // Act & Assert: GitHub 以外のドメインは拒否
      expect(() => client.parseIssueUrl(nonGitHubUrl)).toThrow('Invalid GitHub Issue URL')
    })

    test('不正な形式の場合はエラーを投げる', () => {
      // Arrange
      const client = new GitHubClient()
      const invalidFormat = 'not-a-url'

      // Act & Assert: URL 形式でない場合は拒否
      expect(() => client.parseIssueUrl(invalidFormat)).toThrow('Invalid GitHub Issue URL')
    })
  })
})
