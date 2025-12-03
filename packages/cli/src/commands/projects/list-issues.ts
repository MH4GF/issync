import { GitHubProjectsClient } from '../../lib/github-projects.js'

export interface ListIssuesOptions {
  status: string
  token?: string
}

export async function listIssues(options: ListIssuesOptions): Promise<void> {
  try {
    const client = new GitHubProjectsClient(options.token)
    const issueNumbers = await client.getIssuesByStatus(options.status)
    console.log(JSON.stringify(issueNumbers))
  } catch (error) {
    console.error(
      `⚠️  GitHub Projects query failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}
