import { Octokit } from '@octokit/rest'
import type { CommentData, GitHubIssueInfo } from '../types/index.js'
import { GitHubTokenMissingError, InvalidIssueUrlError } from './errors.js'

export function parseIssueUrl(url: string): GitHubIssueInfo {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
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
