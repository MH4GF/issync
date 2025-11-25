import { GitHubProjectsClient } from '../../lib/github-projects.js'

export interface SetStatusOptions {
  issueUrl: string
  status: string
  token?: string
}

export async function setStatus(options: SetStatusOptions): Promise<void> {
  try {
    const client = new GitHubProjectsClient(options.token)
    await client.updateProjectField(options.issueUrl, 'Status', options.status)
    console.log(`✅ Status set to "${options.status}"`)
  } catch (error) {
    // Log warning but exit with code 0 to not interrupt plugin commands
    console.error(
      `⚠️  GitHub Projects update failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
