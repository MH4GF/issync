import { Octokit } from '@octokit/rest'
import type { GitHubIssueInfo, CommentData } from '../types/index.js'

export class GitHubClient {
  private octokit: Octokit

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    })
  }

  parseIssueUrl(url: string): GitHubIssueInfo {
    const match = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/
    )
    if (!match) {
      throw new Error('Invalid GitHub Issue URL')
    }

    const [, owner, repo, issue_number] = match
    return {
      owner,
      repo,
      issue_number: parseInt(issue_number, 10),
    }
  }

  async getComment(
    owner: string,
    repo: string,
    comment_id: number
  ): Promise<CommentData> {
    const { data } = await this.octokit.rest.issues.getComment({
      owner,
      repo,
      comment_id,
    })

    return {
      id: data.id,
      body: data.body || '',
      updated_at: data.updated_at,
    }
  }

  async createComment(
    owner: string,
    repo: string,
    issue_number: number,
    body: string
  ): Promise<CommentData> {
    const { data } = await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    })

    return {
      id: data.id,
      body: data.body || '',
      updated_at: data.updated_at,
    }
  }

  async updateComment(
    owner: string,
    repo: string,
    comment_id: number,
    body: string
  ): Promise<CommentData> {
    const { data } = await this.octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id,
      body,
    })

    return {
      id: data.id,
      body: data.body || '',
      updated_at: data.updated_at,
    }
  }
}
