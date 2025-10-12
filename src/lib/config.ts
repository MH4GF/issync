import { readFileSync, writeFileSync, existsSync } from 'fs'
import yaml from 'js-yaml'
import type { IssyncConfig } from '../types/index.js'

const CONFIG_FILE = '.issync.yml'

export function loadConfig(): IssyncConfig {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error('.issync.yml not found. Run `issync init` first.')
  }

  const content = readFileSync(CONFIG_FILE, 'utf-8')
  return yaml.load(content) as IssyncConfig
}

export function saveConfig(config: IssyncConfig): void {
  const content = yaml.dump(config)
  writeFileSync(CONFIG_FILE, content, 'utf-8')
}

export function configExists(): boolean {
  return existsSync(CONFIG_FILE)
}
