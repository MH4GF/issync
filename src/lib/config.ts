import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { IssyncConfig } from '../types/index.js'
import { ConfigNotFoundError } from './errors.js'

function getStatePath(cwd = process.cwd()): { stateDir: string; stateFile: string } {
  return {
    stateDir: path.join(cwd, '.issync'),
    stateFile: path.join(cwd, '.issync', 'state.yml'),
  }
}

export function loadConfig(cwd?: string): IssyncConfig {
  const { stateFile } = getStatePath(cwd)

  if (!existsSync(stateFile)) {
    throw new ConfigNotFoundError()
  }

  const content = readFileSync(stateFile, 'utf-8')
  return yaml.load(content) as IssyncConfig
}

export function saveConfig(config: IssyncConfig, cwd?: string): void {
  const { stateDir, stateFile } = getStatePath(cwd)

  // Create directory if it doesn't exist
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  const content = yaml.dump(config)
  writeFileSync(stateFile, content, 'utf-8')
}

export function configExists(cwd?: string): boolean {
  const { stateFile } = getStatePath(cwd)
  return existsSync(stateFile)
}
