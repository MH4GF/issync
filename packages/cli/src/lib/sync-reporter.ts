import type { IssyncSync } from '../types/index.js'

interface SyncFailure {
  sync: IssyncSync
  reason: unknown
}

/**
 * Reports the results of a batch sync operation (push or pull)
 * @param operation - The operation type ('push' or 'pull')
 * @param total - Total number of syncs processed
 * @param failures - Array of failures that occurred
 * @throws Error if any failures occurred
 */
export function reportSyncResults(
  operation: 'push' | 'pull',
  total: number,
  failures: SyncFailure[],
): void {
  const pastTense = operation === 'push' ? 'pushed' : 'pulled'

  if (failures.length === 0) {
    console.log(`✓ Successfully ${pastTense} ${total} sync(s)`)
    return
  }

  const successCount = total - failures.length
  const message = `${failures.length} of ${total} ${operation} operation(s) failed`
  console.error(`\nError: ${message}`)

  for (const { sync, reason } of failures) {
    const label = `${sync.issue_url} → ${sync.local_file}`
    const errorMsg = reason instanceof Error ? reason.message : String(reason)
    console.error(`  ${label}: ${errorMsg}`)
  }

  if (successCount > 0) {
    console.log(`\n✓ ${successCount} sync(s) ${pastTense} successfully`)
  }

  // Check if any failures are due to missing files and suggest clean command
  const hasFileNotFoundError = failures.some((failure) => {
    const errorMsg =
      failure.reason instanceof Error ? failure.reason.message : String(failure.reason)
    return errorMsg.includes('does not exist') || errorMsg.includes('File not found')
  })

  if (hasFileNotFoundError) {
    console.error('\n💡 Tip: Remove stale sync configurations with:')
    console.error('  issync clean --dry-run  # Preview what will be removed')
    console.error('  issync clean            # Remove with confirmation')
  }

  throw new Error(message)
}
