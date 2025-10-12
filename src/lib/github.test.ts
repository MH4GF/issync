import { describe, expect, test } from 'bun:test'
import { GitHubClient } from './github'

describe('GitHubClient', () => {
  describe('parseIssueUrl', () => {
    // The init command parses Issue URLs to extract owner/repo/issue_number
    // This information is required for GitHub API calls
    test('can parse standard GitHub Issue URL', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
      const url = 'https://github.com/MH4GF/issync/issues/123'

      // Act
      const result = client.parseIssueUrl(url)

      // Assert: Extracts correct owner, repo, issue_number
      expect(result).toEqual({
        owner: 'MH4GF',
        repo: 'issync',
        issue_number: 123,
      })
    })

    // Should work even if user copies URL with http://
    test('can parse URL with http protocol', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
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

    // Should work even if user copies URL with query parameters
    test('can parse URL with query parameters', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
      const url = 'https://github.com/facebook/react/issues/12345?foo=bar'

      // Act
      const result = client.parseIssueUrl(url)

      // Assert: Query parameters are ignored
      expect(result).toEqual({
        owner: 'facebook',
        repo: 'react',
        issue_number: 12345,
      })
    })

    // Returns clear error for invalid URLs (user-friendly)
    test('throws error if not an Issue URL', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
      const urlWithoutIssueNumber = 'https://github.com/owner/repo'

      // Act & Assert: Rejects URL without issue number
      expect(() => client.parseIssueUrl(urlWithoutIssueNumber)).toThrow('Invalid GitHub Issue URL')
    })

    test('throws error for Pull Request URL', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
      const pullRequestUrl = 'https://github.com/owner/repo/pulls/123'

      // Act & Assert: PR URL is not an Issue URL
      expect(() => client.parseIssueUrl(pullRequestUrl)).toThrow('Invalid GitHub Issue URL')
    })

    test('throws error for non-GitHub URL', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
      const nonGitHubUrl = 'https://example.com/issues/123'

      // Act & Assert: Rejects domains other than GitHub
      expect(() => client.parseIssueUrl(nonGitHubUrl)).toThrow('Invalid GitHub Issue URL')
    })

    test('throws error for invalid format', () => {
      // Arrange
      const client = new GitHubClient('dummy-token')
      const invalidFormat = 'not-a-url'

      // Act & Assert: Rejects non-URL formats
      expect(() => client.parseIssueUrl(invalidFormat)).toThrow('Invalid GitHub Issue URL')
    })
  })
})
