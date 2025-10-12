import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import type { IssyncConfig } from '../types/index.js'

const STATE_DIR = '.issync'
const STATE_FILE = '.issync/state.yml'

export function loadConfig(): IssyncConfig {
  if (!existsSync(STATE_FILE)) {
    throw new Error('.issync/state.yml not found. Run `issync init` first.')
  }

  const content = readFileSync(STATE_FILE, 'utf-8')
  return yaml.load(content) as IssyncConfig
}

export function saveConfig(config: IssyncConfig): void {
  // ディレクトリがなければ作成
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true })
  }

  const content = yaml.dump(config)
  writeFileSync(STATE_FILE, content, 'utf-8')
}

export function configExists(): boolean {
  return existsSync(STATE_FILE)
}
