#!/usr/bin/env node

import { Command } from 'commander'

const program = new Command()

async function _handleCommand(
  commandFn: (() => void) | (() => Promise<void>),
  successMessage?: string,
): Promise<void> {
  try {
    await commandFn()
    if (successMessage) {
      console.log(successMessage)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Unknown error occurred')
    }
    process.exit(1)
  }
}

program
  .name('issync')
  .description('CLI tool to sync text between GitHub Issue comments and local files')
  .version('0.1.0')

program
  .command('init <issue-url>')
  .description('Initialize issync with a GitHub Issue URL')
  .option('-f, --file <path>', 'Local file path', 'docs/plan.md')
  .option('-t, --template <path>', 'Template file path to initialize from')
  .action(async (issueUrl: string, options: { file: string; template?: string }) => {
    const { init } = await import('./commands/init.js')
    const templateLine = options.template ? `\n  Template: ${options.template}` : ''
    await _handleCommand(
      () => init(issueUrl, { file: options.file, template: options.template }),
      `✓ Initialized issync\n  Issue: ${issueUrl}\n  File:  ${options.file}${templateLine}\n\nRecommended: Add .issync/ to your .gitignore`,
    )
  })

program
  .command('pull')
  .description('Pull remote changes from GitHub Issue to local file')
  .option('-f, --file <path>', 'Select sync target by local file path')
  .option('--issue <url>', 'Select sync target by issue URL')
  .action(async (options: { file?: string; issue?: string }) => {
    const { pull } = await import('./commands/pull.js')
    await _handleCommand(
      async () => pull({ file: options.file, issue: options.issue }),
      '✓ Pulled changes from remote',
    )
  })

program
  .command('push')
  .description('Push local changes to GitHub Issue comment')
  .option('-f, --file <path>', 'Select sync target by local file path')
  .option('--issue <url>', 'Select sync target by issue URL')
  .action(async (options: { file?: string; issue?: string }) => {
    const { push } = await import('./commands/push.js')
    await _handleCommand(
      async () => push({ file: options.file, issue: options.issue }),
      '✓ Pushed changes to remote',
    )
  })

program
  .command('watch')
  .description('Watch for changes and sync automatically (foreground process)')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '10')
  .option('-f, --file <path>', 'Select sync target by local file path')
  .option('--issue <url>', 'Select sync target by issue URL')
  .action(async (options: { interval: string; file?: string; issue?: string }) => {
    const { watch } = await import('./commands/watch.js')
    const interval = Number.parseInt(options.interval, 10)

    const MIN_INTERVAL_SECONDS = 1
    const MAX_INTERVAL_SECONDS = 3600 // 1 hour

    if (
      Number.isNaN(interval) ||
      interval < MIN_INTERVAL_SECONDS ||
      interval > MAX_INTERVAL_SECONDS
    ) {
      console.error(
        `Error: interval must be between ${MIN_INTERVAL_SECONDS} and ${MAX_INTERVAL_SECONDS} seconds`,
      )
      console.error('Recommended: 10-60 seconds (GitHub API rate limit: 5000 req/hour)')
      process.exit(1)
    }
    await watch({ interval, file: options.file, issue: options.issue })
  })

program
  .command('stop')
  .description('Stop the watch daemon')
  .action(() => {
    console.log('stop command')
    // TODO: implement
  })

program
  .command('status')
  .description('Show sync status')
  .action(() => {
    console.log('status command')
    // TODO: implement
  })

program.parse()
