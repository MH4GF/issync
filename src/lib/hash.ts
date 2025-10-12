import { createHash } from 'crypto'

export function calculateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
