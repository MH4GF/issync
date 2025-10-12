#!/usr/bin/env node

import { Command } from 'commander'

const program = new Command()

async function _handleCommand(
  commandFn: () => Promise<void>,
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
  .action(async (issueUrl: string, options: { file: string }) => {
    const { init } = await import('./commands/init.js')
    await _handleCommand(
      async () => init(issueUrl, { file: options.file }),
      `✓ Initialized issync\n  Issue: ${issueUrl}\n  File:  ${options.file}\n\nRecommended: Add .issync/ to your .gitignore`,
    )
  })

program
  .command('pull')
  .description('Pull remote changes from GitHub Issue to local file')
  .action(async () => {
    const { pull } = await import('./commands/pull.js')
    await _handleCommand(async () => pull(), '✓ Pulled changes from remote')
  })

program
  .command('push')
  .description('Push local changes to GitHub Issue comment')
  .action(async () => {
    const { push } = await import('./commands/push.js')
    await _handleCommand(async () => push(), '✓ Pushed changes to remote')
  })

program
  .command('watch')
  .description('Watch for changes and sync automatically')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '10')
  .option('-d, --daemon', 'Run as daemon in background')
  .action(async (options: { interval: string; daemon?: boolean }) => {
    console.log('watch command:', options)
    // TODO: implement
  })

program
  .command('stop')
  .description('Stop the watch daemon')
  .action(async () => {
    console.log('stop command')
    // TODO: implement
  })

program
  .command('status')
  .description('Show sync status')
  .action(async () => {
    console.log('status command')
    // TODO: implement
  })

program.parse()
