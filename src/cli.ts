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
    console.log('init command:', issueUrl, options)
    // TODO: implement
  })

program
  .command('pull')
  .description('Pull remote changes from GitHub Issue to local file')
  .action(async () => {
    console.log('pull command')
    // TODO: implement
  })

program
  .command('push')
  .description('Push local changes to GitHub Issue comment')
  .option('-m, --message <message>', 'Commit message')
  .action(async (options: { message?: string }) => {
    console.log('push command:', options)
    // TODO: implement
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
