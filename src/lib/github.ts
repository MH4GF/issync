import { Octokit } from '@octokit/rest'
import type { CommentData, GitHubIssueInfo } from '../types/index.js'
import { GitHubTokenMissingError, InvalidIssueUrlError } from './errors.js'

export function parseIssueUrl(url: string): GitHubIssueInfo {
  // Robust regex that handles:
  // - Optional protocol (http:// or https://)
  // - Optional www subdomain
  // - github.com domain
  // - Owner/repo validation (alphanumeric, underscores, hyphens, dots)
  // - Optional .git suffix
  // - Issue number
  // - Optional trailing slash, query params, or fragments
  const match = url.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/issues\/(\d+)(?:[/?#].*)?$/,
  )

  if (!match) {
    throw new InvalidIssueUrlError(url)
  }

  const [, owner, repo, issue_number] = match
  return {
    owner,
    repo,
    issue_number: Number.parseInt(issue_number, 10),
  }
}

export class GitHubClient {
  private octokit: Octokit

  constructor(token?: string) {
    const authToken = token ?? process.env.GITHUB_TOKEN
    if (!authToken) {
      throw new GitHubTokenMissingError()
    }

    // Validate token format (GitHub tokens start with ghp_, ghs_, or gho_)
    if (!/^gh[pso]_[a-zA-Z0-9]{36,}$/.test(authToken)) {
      console.warn(
        'Warning: GitHub token format appears invalid. Expected format: ghp_..., ghs_..., or gho_...',
      )
    }

    this.octokit = new Octokit({
      auth: authToken,
    })
  }

  parseIssueUrl(url: string): GitHubIssueInfo {
    return parseIssueUrl(url)
  }

  async getComment(owner: string, repo: string, comment_id: number): Promise<CommentData> {
    const { data } = await this.octokit.rest.issues.getComment({
      owner,
      repo,
      comment_id,
    })

    return {
      id: data.id,
      body: data.body ?? '',
      updated_at: data.updated_at,
    }
  }

  async createComment(
    owner: string,
    repo: string,
    issue_number: number,
    body: string,
  ): Promise<CommentData> {
    const { data } = await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    })

    return {
      id: data.id,
      body: data.body ?? '',
      updated_at: data.updated_at,
    }
  }

  async updateComment(
    owner: string,
    repo: string,
    comment_id: number,
    body: string,
  ): Promise<CommentData> {
    const { data } = await this.octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id,
      body,
    })

    return {
      id: data.id,
      body: data.body ?? '',
      updated_at: data.updated_at,
    }
  }
}

export function createGitHubClient(token?: string): GitHubClient {
  return new GitHubClient(token)
}
