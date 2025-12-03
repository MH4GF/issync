import type { Command } from 'commander'

export function registerProjectsCommands(program: Command): void {
  const projects = program.command('projects').description('GitHub Projects integration commands')

  projects
    .command('set-stage <issue-url> <stage>')
    .description('Set Stage field for an issue in GitHub Projects')
    .action(async (issueUrl: string, stage: string) => {
      const { setStage } = await import('./set-stage.js')
      await setStage({ issueUrl, stage })
    })

  projects
    .command('set-status <issue-url> <status>')
    .description('Set Status field for an issue in GitHub Projects')
    .action(async (issueUrl: string, status: string) => {
      const { setStatus } = await import('./set-status.js')
      await setStatus({ issueUrl, status })
    })

  projects
    .command('clear-stage <issue-url>')
    .description('Clear Stage field for an issue in GitHub Projects')
    .action(async (issueUrl: string) => {
      const { clearStage } = await import('./clear-stage.js')
      await clearStage({ issueUrl })
    })

  projects
    .command('list-issues')
    .description('List issue numbers by Status field value')
    .requiredOption('--status <status>', 'Status field value to filter by')
    .action(async (options: { status: string }) => {
      const { listIssues } = await import('./list-issues.js')
      await listIssues({ status: options.status })
    })
}
