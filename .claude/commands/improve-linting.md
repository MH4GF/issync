# Improve Linting Configuration

You are an expert at analyzing code review feedback and systematically improving linting configurations to prevent similar issues in the future.

## Context

This command should be run AFTER completing a code review cycle (typically using `/code-review`). It analyzes the conversation history to understand:
- What issues were identified in the code review
- What manual fixes were applied
- What patterns could be prevented by linting rules

## Your Task

Systematically improve the linting configuration based on learnings from the recent code review:

### 1. Analyze Conversation History
- Review the conversation to identify code review feedback
- Extract specific issues that were flagged (security, performance, maintainability, etc.)
- Note which issues were manually fixed vs. could be automated

### 2. Research Linting Rules
Use context7 to research appropriate rules:
- For Biome: Check if Biome can detect similar issues (search @context7 biomejs/biome)
- For ESLint: Check typescript-eslint rules for type-aware checks (search @context7 typescript-eslint/typescript-eslint)
- Prioritize rules that match the severity and category of review feedback

Decision criteria:
- **Biome**: Fast, general-purpose rules for daily use (formatting, basic patterns)
- **typescript-eslint**: Type-aware rules requiring type checking (async patterns, Promise handling, type safety)

### 3. Update Configurations

Update `biome.json` for Biome rules:
- Add new rules in appropriate categories (complexity, style, suspicious, etc.)
- Set severity to "error" for issues that should block commits
- Document reasoning inline if rule purpose isn't obvious

Update `eslint.config.mjs` for typescript-eslint rules:
- Add type-aware rules that complement Biome
- Focus on Promise handling, async patterns, type safety
- Include inline comments explaining what each rule prevents

### 4. Fix Detected Issues

Run linters to find existing violations:
```bash
bun run check
```

Fix any issues found:
- Apply auto-fixes where possible (`bun run lint:fix`)
- Manually fix remaining issues
- Ensure all tests still pass (`bun test`)

### 5. Document Decision

Update `docs/plan.md` with a new decision log entry:
- Date and title of the improvement
- Context: What code review feedback triggered this?
- Decision: What rules were added and why?
- Consequences: What does this prevent? Any trade-offs?

Update `CLAUDE.md` if workflow has changed:
- Add new npm scripts if created
- Update "Development Commands" section
- Document any new patterns or conventions

### 6. Verify and Summarize

Run complete verification:
```bash
bun test
bun run check:ci
```

Provide a summary showing:
- ✅ New rules added (Biome vs. ESLint)
- ✅ Issues fixed automatically
- ✅ Documentation updated
- ✅ All checks passing

## Example Workflow

1. User runs `/code-review` → identifies 4 unnecessary `async` keywords
2. User fixes the issues manually
3. User runs this command
4. You identify that typescript-eslint's `@typescript-eslint/require-await` can prevent this
5. You add the rule, run checks, update docs, verify tests pass

## Important Notes

- **Don't guess**: Use context7 to verify rules exist and understand their purpose
- **Be surgical**: Only add rules that address actual issues from code review
- **Document thoroughly**: Future developers need to understand the "why"
- **Verify everything**: All tests must pass, both linters must be green

Follow the dual-linter strategy:
- Biome for fast, daily feedback
- typescript-eslint for deep, type-aware checks in CI
