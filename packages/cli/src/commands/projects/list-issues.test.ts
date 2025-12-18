import { describe, expect, test } from 'bun:test'
import type { IssueWithDetails } from '../../lib/github-projects.js'
import { getStagePriority, sortByStage } from './list-issues.js'

describe('getStagePriority', () => {
  test('returns 0 for "To Start"', () => {
    expect(getStagePriority('To Start')).toBe(0)
  })

  test('returns 1 for "In Progress"', () => {
    expect(getStagePriority('In Progress')).toBe(1)
  })

  test('returns 2 for "To Review"', () => {
    expect(getStagePriority('To Review')).toBe(2)
  })

  test('returns 999 for null', () => {
    expect(getStagePriority(null)).toBe(999)
  })

  test('returns 998 for unknown stage', () => {
    expect(getStagePriority('Unknown Stage')).toBe(998)
  })
})

describe('sortByStage', () => {
  test('sorts issues by Stage priority (To Start first)', () => {
    const issues: IssueWithDetails[] = [
      { number: 1, status: 'implement', stage: 'To Review' },
      { number: 2, status: 'implement', stage: 'To Start' },
      { number: 3, status: 'implement', stage: 'In Progress' },
    ]

    const sorted = sortByStage(issues)

    expect(sorted.map((i) => i.number)).toEqual([2, 3, 1])
  })

  test('places null stage at the end', () => {
    const issues: IssueWithDetails[] = [
      { number: 1, status: 'plan', stage: null },
      { number: 2, status: 'implement', stage: 'To Start' },
      { number: 3, status: 'implement', stage: 'In Progress' },
    ]

    const sorted = sortByStage(issues)

    expect(sorted.map((i) => i.number)).toEqual([2, 3, 1])
  })

  test('places unknown stage before null but after known stages', () => {
    const issues: IssueWithDetails[] = [
      { number: 1, status: 'plan', stage: null },
      { number: 2, status: 'implement', stage: 'Custom Stage' },
      { number: 3, status: 'implement', stage: 'To Review' },
    ]

    const sorted = sortByStage(issues)

    expect(sorted.map((i) => i.number)).toEqual([3, 2, 1])
  })

  test('preserves order for issues with same stage', () => {
    const issues: IssueWithDetails[] = [
      { number: 1, status: 'plan', stage: 'To Start' },
      { number: 2, status: 'implement', stage: 'To Start' },
      { number: 3, status: 'retrospective', stage: 'To Start' },
    ]

    const sorted = sortByStage(issues)

    // Stable sort should preserve original order
    expect(sorted.map((i) => i.number)).toEqual([1, 2, 3])
  })

  test('does not mutate original array', () => {
    const issues: IssueWithDetails[] = [
      { number: 1, status: 'implement', stage: 'To Review' },
      { number: 2, status: 'implement', stage: 'To Start' },
    ]

    const originalOrder = issues.map((i) => i.number)
    sortByStage(issues)

    expect(issues.map((i) => i.number)).toEqual(originalOrder)
  })

  test('handles empty array', () => {
    const sorted = sortByStage([])
    expect(sorted).toEqual([])
  })

  test('handles single item', () => {
    const issues: IssueWithDetails[] = [{ number: 1, status: 'plan', stage: 'To Start' }]

    const sorted = sortByStage(issues)

    expect(sorted).toEqual(issues)
  })
})
