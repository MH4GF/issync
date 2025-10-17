import { Octokit } from '@octokit/rest'
import type { CommentData, GitHubIssueInfo } from '../types/index.js'
import {
  GitHubAuthenticationError,
  GitHubTokenMissingError,
  InvalidIssueUrlError,
} from './errors.js'

// Type guard for Octokit request errors
interface RequestError {
  status: number
}

// issync comment markers for identification
const ISSYNC_MARKER = '<!-- issync:v1 -->'

// Legacy markers for backward compatibility
const ISSYNC_MARKER_START = '<!-- issync:v1:start -->'
const ISSYNC_MARKER_END = '<!-- issync:v1:end -->'

/**
 * Adds issync marker to the beginning of content
 */
export function addMarker(content: string): string {
  return `${ISSYNC_MARKER}\n${content}`
}

/**
 * Checks if a comment body has issync marker
 * Supports both new single marker format and legacy start/end format
 */
export function hasIssyncMarker(body: string): boolean {
  // New format: single marker at the beginning
  if (body.startsWith(`${ISSYNC_MARKER}\n`) || body === ISSYNC_MARKER) {
    return true
  }

  // Legacy format: start/end markers (backward compatibility)
  if (body.includes(ISSYNC_MARKER_START) && body.includes(ISSYNC_MARKER_END)) {
    return true
  }

  return false
}

/**
 * Removes issync marker from content
 * Returns the content as-is if no marker is found
 * Supports both new single marker format and legacy start/end format
 */
export function removeMarker(body: string): string {
  // New format: marker at the beginning with trailing newline
  if (body.startsWith(`${ISSYNC_MARKER}\n`)) {
    return body.slice(ISSYNC_MARKER.length + 1) // +1 for '\n'
  }

  // New format: marker only (no trailing newline)
  if (body === ISSYNC_MARKER) {
    return ''
  }

  // Legacy format: start/end markers (backward compatibility)
  const startIndex = body.indexOf(ISSYNC_MARKER_START)
  const endIndex = body.indexOf(ISSYNC_MARKER_END)
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const contentStart = startIndex + ISSYNC_MARKER_START.length
    const content = body.slice(contentStart, endIndex)
    // Remove leading/trailing newlines from extracted content
    return content.replace(/^\n+/, '').replace(/\n+$/, '')
  }

  // No marker - return as-is
  return body
}

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

  async listComments(owner: string, repo: string, issue_number: number): Promise<CommentData[]> {
    const { data } = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number,
    })

    return data.map((comment) => ({
      id: comment.id,
      body: comment.body ?? '',
      updated_at: comment.updated_at,
    }))
  }

  /**
   * Handles errors from getComment, re-throwing authentication errors
   * Returns true if should fall through to search (404 or no markers)
   */
  private handleGetCommentError(error: unknown): void {
    const isRequestError = (err: unknown): err is RequestError =>
      typeof err === 'object' && err !== null && 'status' in err

    if (isRequestError(error)) {
      if (error.status === 401 || error.status === 403) {
        throw new GitHubAuthenticationError()
      }
      if (error.status === 404) {
        return // Fall through to search
      }
      throw error // Unexpected error (network failure, rate limit, etc.)
    }
    throw error
  }

  /**
   * Finds an issync comment by marker detection
   * Uses a two-step approach:
   * 1. If comment_id is provided, verify it has markers
   * 2. Otherwise, search all comments for markers
   */
  async findIssyncComment(
    owner: string,
    repo: string,
    issue_number: number,
    comment_id?: number,
  ): Promise<CommentData | null> {
    // Step 1: If comment_id provided, verify it has markers
    if (comment_id) {
      try {
        const comment = await this.getComment(owner, repo, comment_id)
        if (hasIssyncMarker(comment.body)) {
          return comment
        }
        // Comment exists but doesn't have markers - fall through to search
      } catch (error) {
        this.handleGetCommentError(error)
        // If no error was thrown, fall through to search
      }
    }

    // Step 2: Search all comments for markers
    const comments = await this.listComments(owner, repo, issue_number)
    const issyncComment = comments.find((comment) => hasIssyncMarker(comment.body))

    return issyncComment ?? null
  }
}

export function createGitHubClient(token?: string): GitHubClient {
  return new GitHubClient(token)
}
