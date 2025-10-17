import type { IssyncSync } from '../../types/index.js'

/**
 * Type for preparation failures (when preparing targets with safety checks)
 */
type PreparationFailure = {
  sync: IssyncSync
  error: string
}

/**
 * Type for session startup failures (when starting watch sessions)
 */
type SessionStartupFailure = {
  target: { sync: IssyncSync; resolvedPath: string }
  error: unknown
}

/**
 * Report failures that occurred during target preparation
 *
 * Used when safety checks fail or file paths cannot be resolved.
 *
 * @param failures - Array of preparation failures
 */
export function reportPreparationFailures(failures: PreparationFailure[]): void {
  if (failures.length === 0) return

  console.error(`Failed to prepare ${failures.length} sync(s):`)
  for (const { sync, error } of failures) {
    console.error(`  ${sync.issue_url}: ${error}`)
  }
}

/**
 * Report failures that occurred during session startup
 *
 * Used when watch sessions fail to start after passing safety checks.
 *
 * @param failures - Array of session startup failures
 */
export function reportSessionStartupFailures(failures: SessionStartupFailure[]): void {
  if (failures.length === 0) return

  console.error(`\n${failures.length} session(s) failed to start`)
  for (const { target, error } of failures) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`  ${target.sync.issue_url}: ${errorMsg}`)
  }
}

/**
 * Format an error for display
 *
 * Converts unknown error types to strings consistently.
 * Handles various error formats including Error objects, strings,
 * objects with message properties, and other types.
 *
 * @param error - The error to format
 * @returns Formatted error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}
