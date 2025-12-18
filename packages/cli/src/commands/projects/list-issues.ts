import { GitHubProjectsClient, type IssueWithDetails } from '../../lib/github-projects.js'

export interface ListIssuesOptions {
  status: string
  limit?: number
  token?: string
}

// Stage priority order: To Start > In Progress > To Review > (empty/null)
const STAGE_PRIORITY: Record<string, number> = {
  'To Start': 0,
  'In Progress': 1,
  'To Review': 2,
}

function getStagePriority(stage: string | null): number {
  if (stage === null) return 999
  return STAGE_PRIORITY[stage] ?? 998
}

function sortByStage(issues: IssueWithDetails[]): IssueWithDetails[] {
  return [...issues].sort((a, b) => getStagePriority(a.stage) - getStagePriority(b.stage))
}

export async function listIssues(options: ListIssuesOptions): Promise<void> {
  try {
    const client = new GitHubProjectsClient(options.token)

    // Support comma-separated status values
    const statusValues = options.status.split(',').map((s) => s.trim())

    const issues = await client.getIssuesWithDetails(statusValues)

    // Sort by Stage priority
    const sortedIssues = sortByStage(issues)

    // Apply limit if specified
    const limitedIssues = options.limit ? sortedIssues.slice(0, options.limit) : sortedIssues

    // Output issue numbers as JSON array
    const issueNumbers = limitedIssues.map((issue) => issue.number)
    console.log(JSON.stringify(issueNumbers))
  } catch (error) {
    console.error(
      `⚠️  GitHub Projects query failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}
