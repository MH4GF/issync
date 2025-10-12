#!/usr/bin/env node

import { Command } from 'commander'

const program = new Command()

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
    try {
      await init(issueUrl, { file: options.file })
      console.log('✓ Initialized issync')
      console.log(`  Issue: ${issueUrl}`)
      console.log(`  File:  ${options.file}`)
      console.log('\nRecommended: Add .issync/ to your .gitignore')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`)
      } else {
        console.error('Unknown error occurred')
      }
      process.exit(1)
    }
  })

program
  .command('pull')
  .description('Pull remote changes from GitHub Issue to local file')
  .action(async () => {
    const { pull } = await import('./commands/pull.js')
    try {
      await pull()
      console.log('✓ Pulled changes from remote')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`)
      } else {
        console.error('Unknown error occurred')
      }
      process.exit(1)
    }
  })

program
  .command('push')
  .description('Push local changes to GitHub Issue comment')
  .action(async () => {
    const { push } = await import('./commands/push.js')
    try {
      await push()
      console.log('✓ Pushed changes to remote')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`)
      } else {
        console.error('Unknown error occurred')
      }
      process.exit(1)
    }
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
