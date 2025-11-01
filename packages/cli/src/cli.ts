#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
  version?: string
}

if (!packageJson.version || typeof packageJson.version !== 'string') {
  console.error(
    'Error: Failed to read version from package.json. Please ensure package.json contains a valid "version" field.',
  )
  process.exit(1)
}

const program = new Command()

async function _handleCommand(
  commandFn: (() => void) | (() => Promise<void>),
  successMessage?: string | (() => string),
): Promise<void> {
  try {
    await commandFn()
    if (successMessage) {
      const message = typeof successMessage === 'function' ? successMessage() : successMessage
      console.log(message)
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
  .version(packageJson.version)

program
  .command('init <issue-url>')
  .description('Initialize issync (detects existing comments automatically)')
  .option('-f, --file <path>', 'Local file path (default: .issync/docs/plan-{issue-number}.md)')
  .option(
    '-t, --template <path>',
    'Template file path or URL to initialize from (defaults to official template if file does not exist)',
  )
  .action(async (issueUrl: string, options: { file?: string; template?: string }) => {
    const { init } = await import('./commands/init.js')
    const templateLine = options.template ? `\n  Template: ${options.template}` : ''
    let actualFilePath = ''

    await _handleCommand(
      async () => {
        actualFilePath = await init(issueUrl, {
          file: options.file,
          template: options.template,
        })
      },
      () =>
        `✓ Initialized issync\n  Issue: ${issueUrl}\n  File:  ${actualFilePath}${templateLine}\n\nRecommended: Add .issync/ to your .gitignore`,
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
  .command('list')
  .description('List all sync configurations')
  .action(async () => {
    const { list } = await import('./commands/list.js')
    await _handleCommand(() => list())
  })

program
  .command('push')
  .description('Push local changes to GitHub Issue comment')
  .option('-f, --file <path>', 'Select sync target by local file path')
  .option('--issue <url>', 'Select sync target by issue URL')
  .option('--force', 'Skip optimistic lock check and force overwrite remote')
  .action(async (options: { file?: string; issue?: string; force?: boolean }) => {
    const { push } = await import('./commands/push.js')
    const successMessage = options.force
      ? '✓ Force pushed changes to remote'
      : '✓ Pushed changes to remote'
    await _handleCommand(
      async () => push({ file: options.file, issue: options.issue, force: options.force }),
      successMessage,
    )
  })

program
  .command('remove')
  .description('Remove sync configuration from state.yml')
  .option('-f, --file <path>', 'Select sync target by local file path')
  .option('--issue <url>', 'Select sync target by issue URL')
  .option('--delete-file', 'Also delete the local file')
  .action(async (options: { file?: string; issue?: string; deleteFile?: boolean }) => {
    const { remove } = await import('./commands/remove.js')
    await _handleCommand(() =>
      remove({ file: options.file, issue: options.issue, deleteFile: options.deleteFile }),
    )
  })

program
  .command('clean')
  .description('Remove stale sync configurations (where local file does not exist)')
  .option('--dry-run', 'Show what would be removed without actually removing')
  .option('--force', 'Remove without confirmation prompt')
  .action(async (options: { dryRun?: boolean; force?: boolean }) => {
    const { clean } = await import('./commands/clean.js')
    await _handleCommand(() => clean({ dryRun: options.dryRun, force: options.force }))
  })

program
  .command('watch')
  .description('Watch for changes and sync automatically (foreground process)')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '30')
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
      console.error('Recommended: 30-60 seconds (GitHub API rate limit: 5000 req/hour)')
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
