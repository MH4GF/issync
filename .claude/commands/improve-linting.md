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

**Choose recording level based on importance:**

**Tier 1: Architectural decisions** (design philosophy, SSoT selection, language choice)
- Record in detail in `docs/plan.md` decision log (background, rationale, trade-offs)
- Use this sparingly - only for decisions that affect core architecture

**Tier 2: Tactical decisions** (lint rule additions, tool introductions)
- Record **1-2 lines** in `docs/plan.md` decision log:
  ```
  **YYYY-MM-DD: [Title]**
  - [Rule name] added (reason: prevents XXX from code review feedback)
  ```
- Use this for most linting improvements

**Tier 3: Operational changes** (command additions, bug fixes)
- Record briefly in `docs/plan.md` "発見と気づき" section (1-2 paragraphs)

**Recording principles:**
- ❌ Don't include pseudo-code, directory structure diagrams (code speaks for itself)
- ❌ Don't write implementation details (check `src/` for that)
- ✅ Focus on **Why** (why this decision was made)
- ✅ Minimum information needed for future self to understand

**Update `CLAUDE.md` if workflow has changed:**
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
5. You add the rule, run checks
6. You document in plan.md (Tier 2 - one line):
   ```
   **2025-10-12: lint - require-await 追加**
   - @typescript-eslint/require-await 追加（コードレビュー指摘の予防）
   ```
7. Verify tests pass

## Important Notes

- **Don't guess**: Use context7 to verify rules exist and understand their purpose
- **Be surgical**: Only add rules that address actual issues from code review
- **Document concisely**: Record the "why" in 1-2 lines (Tier 2) - avoid implementation details
- **Verify everything**: All tests must pass, both linters must be green

Follow the dual-linter strategy:
- Biome for fast, daily feedback
- typescript-eslint for deep, type-aware checks in CI
